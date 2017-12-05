"use strict";
//加载所需要的模块
var http = require('http');
var url = require('url');
var fs = require('fs');
var path = require('path');
var cp = require('child_process');
var req = require('request');

//创建服务
var httpServer = http.createServer(processRequest);

var port = 8080;

//指定一个监听的接口
httpServer.listen(port, function () {
    console.log(`App is running at port:${port}`);
    console.log(`Listening url: http://localhost:${port}`);
    //cp.exec(`explorer http://localhost:${port}`, function () {
    //});
});

function createFolder(to) { //文件写入
    var sep = path.sep;
    var folders = path.dirname(to).split(sep);
    var p = '';
    while (folders.length) {
        p += folders.shift() + sep;
        if (!fs.existsSync(p)) {
            fs.mkdirSync(p);
        }
    }
};

createFolder(__dirname + "/static/");

//响应请求的函数
function processRequest(request, response) {
    //mime类型
    var mime = {
        "css": "text/css",
        "gif": "image/gif",
        "html": "text/html",
        "ico": "image/x-icon",
        "jpeg": "image/jpeg",
        "jpg": "image/jpeg",
        "js": "text/javascript",
        "json": "application/json",
        "pdf": "application/pdf",
        "png": "image/png",
        "svg": "image/svg+xml",
        "swf": "application/x-shockwave-flash",
        "tiff": "image/tiff",
        "txt": "text/plain",
        "wav": "audio/x-wav",
        "wma": "audio/x-ms-wma",
        "wmv": "video/x-ms-wmv",
        "xml": "text/xml"
    };

    //request里面切出标识符字符串
    var requestUrl = request.url;

    //requestUrl = requestUrl.replace(/en_us/g, 'zh_cn');

    //url模块的parse方法 接受一个字符串，返回一个url对象,切出来路径
    var pathName = url.parse(requestUrl).pathname;
    //console.info("Request url: " + requestUrl);

    if (pathName === '/') {
        pathName = '/index.html';
    }

    //对路径解码，防止中文乱码
    var pathName = decodeURI(pathName);

    //解决301重定向问题，如果pathname没以/结尾，并且没有扩展名
    if (!pathName.endsWith('/') && path.extname(pathName) === '') {
        if (pathName.indexOf('puzzle') > 0) {
            pathName += '.html';
        } else {
            pathName += '/';
        }
        var redirect = "//" + request.headers.host + pathName;
        response.writeHead(301, {
            location: redirect
        });
        //response.end方法用来回应完成后关闭本次对话，也可以写入HTTP回应的具体内容。
        response.end();
        return;
    }

    if (pathName.indexOf('user_progress') > 0) {
        response.writeHead(404, { "content-type": "text/html" });
        response.end("<h1>404 Not Found</h1>");
        return;
    }

    //获取资源文件的绝对路径
    var filePath = path.resolve(__dirname + "/static/" + pathName);
    //获取对应文件的文档类型
    //我们通过path.extname来获取文件的后缀名。由于extname返回值包含”.”，所以通过slice方法来剔除掉”.”，
    //对于没有后缀名的文件，我们一律认为是unknown。
    var ext = path.extname(pathName);
    ext = ext ? ext.slice(1) : 'unknown';

    if (path.extname(pathName) === '') {
        filePath += '.html';
        ext = 'html';
    }

    //console.info("Real path: " + filePath);

    //未知的类型一律用"text/plain"类型
    var contentType = mime[ext] || "text/plain";

    fs.stat(filePath, (err, stats) => {
        if (err) {
            if (ext !== 'unknown') {
                var j = req.jar();
                var cookie = req.cookie('language_=zh-CN; _ga=GA1.2.1072421902.1512397011; _gid=GA1.2.1936149295.1512397011; _learn_session=OGFsTkVZdkhHS1FralU1Z0JlMnFERnV1V3J0ZCtRaFIvRDREdGM4anRYN2pyb3RkeUZ2OVE0S0NkYXc4eklEMFNkZGVndXgvQUwvVHE4Rk85WXBIWEE9PS0tVnBvVkhJbTljQTljK3dPN2htT2JoQT09--61ffc919912029992b91b5b1aad082da2cfb72a3; AWSELB=45A15F0B18FD379190F175F7854CB43DA5889E7EC4D03544389E3B7D04CA0460FC38FABB6DF500783AAA79F9A80FDC5BA77525F53ACA4E0E6CF084B5B60C6E4E70433F61E4');
                var proxy_src = 'https://studio.code.org' + pathName;
                proxy_src = proxy_src.replace(/(index)?\.html/g, '');
                j.setCookie(cookie, proxy_src);
                console.info("** Download: " + filePath);
                createFolder(filePath);
                req({ url: proxy_src, jar: j }).pipe(fs.createWriteStream(filePath));

                if (ext === 'html') {
                    response.writeHead(200, { "content-type": contentType });
                    response.end('<html><head><meta http-equiv="refresh" content="2"></head><body><h1>Loading...</h1><hr><h3>'+proxy_src+'</h3></body></html>');
                    return;
                }

                response.writeHead(404, { "content-type": "text/html" });
                response.end("<h1>404 Not Found</h1>");
            }
        }
        //没出错 并且文件存在
        if (!err && stats.isFile()) {
            if (ext === 'html') {
                var text = fs.readFileSync(filePath, 'utf8');
                text = text.replace(/(https?:)?\/\/studio\.code\.org/g, '');
                console.info("Update html: " + filePath);
                fs.writeFileSync(filePath, text, 'utf8');
                response.writeHead(200, { "content-type": contentType });
                response.end(text);
                return;
            }
            readFile(filePath, contentType);
        }
        //如果路径是目录
        if (!err && stats.isDirectory()) {
            var html = "<head><meta charset = 'utf-8'/></head><body><ul>";
            //读取该路径下文件
            fs.readdir(filePath, (err, files) => {
                if (err) {
                    console.log("读取路径失败！");
                } else {
                    //做成一个链接表，方便用户访问
                    var flag = false;
                    for (var file of files) {
                        //如果在目录下找到index.html，直接读取这个文件
                        if (file === "index.html") {
                            readFile(filePath + (filePath[filePath.length - 1] == '/' ? '' : '/') + 'index.html', "text/html");
                            flag = true;
                            break;
                        };
                        html += `<li><a href='${file}'>${file}</a></li>`;
                    }
                    if (!flag) {
                        html += '</ul></body>';
                        response.writeHead(200, { "content-type": "text/html" });
                        response.end(html);
                    }
                }
            });
        }

        //读取文件的函数
        function readFile(filePath, contentType) {
            response.writeHead(200, { "content-type": contentType });
            //建立流对象，读文件
            var stream = fs.createReadStream(filePath);
            //错误处理
            stream.on('error', function () {
                response.writeHead(500, { "content-type": contentType });
                response.end("<h1>500 Server Error</h1>");
            });
            //读取文件
            stream.pipe(response);
        }
    });
}