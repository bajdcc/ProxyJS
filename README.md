# 在线代理兼缓存网站（Node.js）

## 大体思路

拦截每一个请求，如果URI本地存在，则返回文件内容，如果不存在，则到远程主机上下载到本地并返回。