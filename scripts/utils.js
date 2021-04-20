const DEBUG = false;

const blacklist = [
    'www.googleadservices.com/pagead/conversion_async.js',
    'www.googleadservices.com/pagead/conversion.js'
];

let database = [];

const patternMatch = (response, database) => {
    const result = [];
    const matches = [];

    database.forEach((pattern) => {
        const { name, type, chunk } = pattern;

        switch (type) {
            case 'regex':
                const re = new RegExp(chunk);
                const match = re.exec(response);

                if (match) {
                    result.push(name);
                    matches.push(match);
                };
                break;
            case 'text':
                const position = response.indexOf(chunk);

                if (position != -1) {
                    result.push(name);
                    matches.push({ index: position });
                };
                break;
        }
    });

    return [result, matches];
};

const downloadDB = (url) => {
    return new Promise((resolve, reject) => {
        fetch(url).then(
                response => response.text()
            ).then(res => {
                const ret = res.split('\n').map(line => {
                    line = line.trim();
                    if (line.startsWith('#') || line == '') { return; }

                    let data = line.split('|');
                    let name, type, chunk;

                    name = data[0].trim();
                    type = data[1].trim();
                    chunk = data.slice(2).join('|').trim();

                    return { name, type, chunk };
                }).filter(notnull => notnull);

                resolve(ret);
            })
            .catch(err => {
                console.log(err);
                reject(new Error('Error downloading ' + url))
            })
    });
};

const download = (url) => {
    return new Promise((resolve, reject) => {
        fetch(url).then(
                response => response.text()
            ).then(data => {
                resolve(data);
            })
            .catch(err => {
                reject(new Error('Error downloading ' + url))
            })
    });
};

const check = ({ requestUri, initiator }) => {
    if (DEBUG) {
        console.log(`[%] ${requestUri}`)
    }

    const url = new URL(requestUri);

    if (blacklist.indexOf(url.hostname + url.pathname) != -1) {
        return;
    };
    if (!url.hostname || !url.pathname) {
        return;
    };
    if (url.protocol == "http:" || url.protocol == "https:") {
        download(url).then(res => {
            const [result, match] = patternMatch(res, database);

            result.forEach((name, i) => {
                const preChunk = res.substr(0, match[i].index).split(/\n/);
                const line = preChunk.length;
                const column = preChunk[preChunk.length - 1].length;

                found.add(`[${name}] ${initiator}\n${requestUri}:${line}:${column}`)
                setBadgeCount(found.size);
            });
        })
    }
};

const filter = {
    urls: ["<all_urls>"],
    types: ["script"]
};

const scan = ({ method, url, initiator }) => {
    // if (method == "GET") {
    check({ requestUri: url, initiator });
    // }
};

const updateDB = () => {
    if (!database.length) {
        downloadDB(databaseUrl).then((_database) => {
            database = _database;
            chrome.webRequest.onCompleted.addListener(scan, filter, []);
        }).catch(e => console.log(e));
    }
};

const setBadgeCount = (len) => {
    chrome.browserAction.setBadgeText({ "text": '' + len });
    chrome.browserAction.setBadgeBackgroundColor({ color: len > 0 ? [255, 0, 0, 255] : [0, 0, 255, 0] });

    return;
};

const maybeSame = (a, b) => {
    return a.touppercase().trim() == b.touppercase().trim();
};

const isCSPHeader = ({ header: name }) => {
    return maybeSame(name, 'Content-Security-Policy');
};

const isXFrameEnabled = ({ header: name }) => {
    return maybeSame(name, 'X-Frame-Options');
};

const isCached = ({ header: name }) => {
    return maybeSame(name, 'If-None-Match');
};