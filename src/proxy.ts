'use strict';

import { Url, parse as parseUrl } from 'url';
import HttpProxyAgent = require('http-proxy-agent');
import HttpsProxyAgent = require('https-proxy-agent');

export namespace Proxy {

    function getSystemProxyURL(requestURL: Url): string {
        if (requestURL.protocol === 'http:') {
            return process.env.HTTP_PROXY || process.env.http_proxy || null;
        } else if (requestURL.protocol === 'https:') {
            return process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || null;
        }

        return null;
    }

    export function getProxyAgent(requestURL: Url, proxy: string, strictSSL: boolean): any {
        const proxyURL = proxy || getSystemProxyURL(requestURL);

        if (!proxyURL) {
            return null;
        }

        const proxyEndpoint = parseUrl(proxyURL);

        if (!/^https?:$/.test(proxyEndpoint.protocol)) {
            return null;
        }

        const opts = {
            host: proxyEndpoint.hostname,
            port: Number(proxyEndpoint.port),
            auth: proxyEndpoint.auth,
            rejectUnauthorized: strictSSL
        };

        return requestURL.protocol === 'http:' ? new HttpProxyAgent(opts) : new HttpsProxyAgent(opts);
    }
}