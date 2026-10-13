"""Dead-socket reproduction for the storage keepalive fix (Linux container).

A pooled keep-alive connection is blackholed with iptables DROP (no FIN, no
RST: what a NAT that forgot the flow does), then the pool is used again.
Timings are scaled down: read timeout 20 s instead of 300 s, keepalive idle
3 s / interval 1 s / count 2 (TCP_USER_TIMEOUT 5 s) instead of 60/10/3 (90 s).
The socket options come from the real _candidate_socket_options() source in
backend/app/services/storage_service.py.
"""
import ast
import http.server
import logging
import socket
import subprocess
import sys
import threading
import time

sys.path.insert(0, "/repro/lib")
import urllib3  # noqa: E402  (urllib3 2.8.0, the version the backend pins transitively)
from urllib3.util.connection import is_connection_dropped  # noqa: E402

logging.basicConfig(level=logging.WARNING, format="    urllib3: %(message)s")

source = open("/repro/storage_service.py").read()
namespace = {"socket": socket}
for node in ast.parse(source).body:
    if isinstance(node, ast.FunctionDef) and node.name == "_candidate_socket_options":
        exec(compile(ast.Module([node], []), "storage_service.py", "exec"), namespace)
candidate_socket_options = namespace["_candidate_socket_options"]


class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Length", "2")
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, *_args):
        pass


server = http.server.ThreadingHTTPServer(("127.0.0.1", 8080), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()

READ_TIMEOUT = 20


def blackhole(action, client_port):
    for match in (["--sport", "8080", "--dport", str(client_port)], ["--dport", "8080", "--sport", str(client_port)]):
        subprocess.run(["iptables", action, "INPUT", "-p", "tcp", *match, "-j", "DROP"], check=True)


def scenario(name, socket_options, idle_wait):
    kwargs = dict(timeout=urllib3.Timeout(connect=5, read=READ_TIMEOUT),
                  retries=urllib3.Retry(total=5, backoff_factor=0.2, status_forcelist=[500, 502, 503, 504]))
    if socket_options is not None:
        kwargs["socket_options"] = socket_options
    pool = urllib3.PoolManager(**kwargs)
    assert pool.request("GET", "http://127.0.0.1:8080/").data == b"ok"
    conn_pool = pool.connection_from_host("127.0.0.1", 8080, scheme="http")
    conn = next(c for c in conn_pool.pool.queue if c is not None and c.sock is not None)
    port = conn.sock.getsockname()[1]
    blackhole("-I", port)
    try:
        time.sleep(idle_wait)
        dropped = is_connection_dropped(conn)
        started = time.monotonic()
        response = pool.request("GET", "http://127.0.0.1:8080/")
        elapsed = time.monotonic() - started
        new_port = next(c for c in conn_pool.pool.queue if c is not None and c.sock is not None).sock.getsockname()[1]
        print(f"{name}: idle {idle_wait}s after blackhole, checkout saw dead socket={dropped}, "
              f"second request {response.status} in {elapsed:.2f}s, connection port {port} -> {new_port}")
    finally:
        blackhole("-D", port)
        pool.clear()


print("kernel:", subprocess.run(["uname", "-r"], capture_output=True, text=True).stdout.strip())
production = candidate_socket_options(60, 10, 3)
probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
for level, option, value in production:
    probe.setsockopt(level, option, value)  # raises if this kernel rejects one
print("production options accepted by this kernel:", production)
probe6 = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
for level, option, value in production:
    probe6.setsockopt(level, option, value)
print("same options accepted on an AF_INET6 socket: yes")

scaled = candidate_socket_options(3, 1, 2)
print("scaled options:", scaled)
scenario("A baseline (urllib3 default options)", None, 8)
scenario("B keepalive, idle connection reused", scaled, 8)
scenario("C keepalive, reused right after the path died", scaled, 0)
