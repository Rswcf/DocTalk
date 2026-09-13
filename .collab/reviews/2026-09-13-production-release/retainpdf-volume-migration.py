import os, stat
assert os.geteuid() == 0
root = '/data'
root_info = os.lstat(root)
assert stat.S_ISDIR(root_info.st_mode)
trees = ['/data/' + name for name in ['downloads', 'db', 'jobs', 'uploads', 'typst-package-cache', 'agent-runtime', 'runtime-home']]
def raise_walk_error(error):
 raise error
# Preflight every existing node before changing any ownership.
for tree in trees:
 if not os.path.lexists(tree):
  continue
 assert stat.S_ISDIR(os.lstat(tree).st_mode)
 for path, dirs, files, fd in os.fwalk(tree, follow_symlinks=False, onerror=raise_walk_error):
  nodes = [os.fstat(fd)] + [os.stat(n, dir_fd=fd, follow_symlinks=False) for n in dirs + files]
  for info in nodes:
   assert info.st_dev == root_info.st_dev, 'Nested mount is unsupported'
   assert not info.st_mode & (stat.S_ISUID | stat.S_ISGID), 'Special mode is unsupported'
assert not root_info.st_mode & (stat.S_ISUID | stat.S_ISGID)
changed = 0
for tree in trees:
 if not os.path.lexists(tree):
  continue
 for path, dirs, files, fd in os.fwalk(tree, follow_symlinks=False, onerror=raise_walk_error):
  os.fchown(fd, 10001, 10001); changed += 1
  for name in files:
   info = os.stat(name, dir_fd=fd, follow_symlinks=False)
   if stat.S_ISREG(info.st_mode):
    os.chown(name, 10001, 10001, dir_fd=fd, follow_symlinks=False); changed += 1
os.chown(root, 10001, 10001, follow_symlinks=False)
print('owned_paths_migrated', changed + 1, 'uid', 10001, 'gid', 10001, flush=True)
# The temporary migration image starts the API only after privilege drop.
os.execv('/usr/bin/setpriv', ['setpriv', '--reuid=10001', '--regid=10001', '--init-groups', '--no-new-privs', '/entrypoint.sh'])
