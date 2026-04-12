对抗审阅
1) diff：两文件改动与声明一致。
2) tag：本机`docker manifest inspect`/`curl`因沙箱DNS失败，改查Docker Hub。`python:3.12.7-slim`、`postgres:16.6`、`redis:7.4.1-alpine`、`minio:RELEASE.2024-12-18...`可确认；`qdrant/qdrant:v1.12.4`未检索到官方层页，存在性未证实。
3) 兼容：`qdrant-client==1.16.1`，官方仅回测向后3个minor，1.12.x超窗。
4) 取舍：patch pin易维护；digest更可复现、更抗tag重写。
5) 结论：暂不通过。需联网复核`qdrant/qdrant:v1.12.4`或改可证实tag/digest。
