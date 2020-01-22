"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function promiseTimeout(ms, promise) {
    return new Promise(function (resolve, reject) {
        var timer = setTimeout(function () {
            reject(new Error("Promise timeout"));
        }, ms);
        promise
            .then(function (res) {
            clearTimeout(timer);
            resolve(res);
        })
            .catch(function (err) {
            clearTimeout(timer);
            reject(err);
        });
    });
}
exports.promiseTimeout = promiseTimeout;
function promiseAllTimeout(ms, promiseArray) {
    return new Promise(function (resolve, reject) {
        var timer = setTimeout(function () {
            reject(new Error("Promise timeout"));
        }, ms);
        Promise.all(promiseArray)
            .then(function (res) {
            clearTimeout(timer);
            resolve(res);
        })
            .catch(function (err) {
            clearTimeout(timer);
            reject(err);
        });
    });
}
exports.promiseAllTimeout = promiseAllTimeout;
function reduceObjectToAllowedKeys(object, keys) {
    return Object.keys(object)
        .filter(key => keys.includes(key))
        .reduce((obj, key) => {
        obj[key] = object[key];
        return obj;
    }, {});
}
exports.reduceObjectToAllowedKeys = reduceObjectToAllowedKeys;
function objectGroupByPropertyAndCount(objectArray, prop) {
    let gbResult = objectGroupByProperty(objectArray, prop);
    if (Object.keys(gbResult).length > 0) {
        let gbResultReduced = [];
        Object.keys(gbResult).forEach(x => {
            let obj = {};
            obj[prop] = x;
            obj["values"] = gbResult[x].length;
            gbResultReduced.push(obj);
        });
        return gbResultReduced;
    }
    return [];
}
exports.objectGroupByPropertyAndCount = objectGroupByPropertyAndCount;
function objectGroupByProperty(obj, prop) {
    return obj.reduce(function (rv, x) {
        (rv[x[prop]] = rv[x[prop]] || []).push(x);
        return rv;
    }, {});
}
exports.objectGroupByProperty = objectGroupByProperty;
//# sourceMappingURL=utils.js.map