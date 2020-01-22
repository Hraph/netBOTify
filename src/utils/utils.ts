/**
 * Wait promise to finish before timeout
 * @param {number} ms
 * @param {Promise<any>} promise
 * @returns {Promise<any>}
 */
export function promiseTimeout(ms: number, promise: Promise<any>){
    return new Promise(function(resolve, reject){
        // create a timeout to reject promise if not resolved
        var timer = setTimeout(function(){
            reject(new Error("Promise timeout"));
        }, ms);

        promise
            .then(function(res){
                clearTimeout(timer);
                resolve(res);
            })
            .catch(function(err){
                clearTimeout(timer);
                reject(err);
            });
    });
}

/**
 * Wait all promises to finish before timeout
 * @param {number} ms
 * @param {Promise<any>[]} promiseArray
 * @returns {Promise<any>}
 */
export function promiseAllTimeout(ms: number, promiseArray: Promise<any>[]){
    return new Promise(function(resolve, reject){
        // create a timeout to reject promise if not resolved
        var timer = setTimeout(function(){
            reject(new Error("Promise timeout"));
        }, ms);

        Promise.all(promiseArray)
            .then(function(res){
                clearTimeout(timer);
                resolve(res);
            })
            .catch(function(err){
                clearTimeout(timer);
                reject(err);
            });
    });
}

/**
 * Reduce an object properties to a certain list of allowed keys
 * @param object
 * @param {Array<String>} keys
 * @returns {Object}
 */
export function reduceObjectToAllowedKeys(object: any, keys: any): Object {
    return Object.keys(object)
        .filter(key => keys.includes(key))
        .reduce((obj: any, key: any) => {
            obj[key] = object[key];
            return obj;
        }, {});
}

/**
 * Group by an object array property and count occurrences
 * @param {any[]} objectArray
 * @param {string} prop
 * @returns {any}
 * @private
 */
export function objectGroupByPropertyAndCount(objectArray: any[], prop: string){
    let gbResult = objectGroupByProperty(objectArray, prop);

    if (Object.keys(gbResult).length > 0){ // Has result: format
        let gbResultReduced: any = [];

        Object.keys(gbResult).forEach(x => { // Create value object
            let obj: any = {};
            obj[prop] = x;
            obj["values"] = gbResult[x].length;
            gbResultReduced.push(obj);
        });
        return gbResultReduced;
    }
    return [];
}

/**
 * Return an objectArray grouped by a property
 * @param obj
 * @param {string} prop
 * @private
 */
export function objectGroupByProperty(obj: any, prop: string){
    return obj.reduce(function(rv: any, x: any) {
        (rv[x[prop]] = rv[x[prop]] || []).push(x);
        return rv;
    }, {});
}