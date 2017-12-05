/*

angular-rest
(c) goze
License: MIT

Table of Contents:

- class RESTClient

- Class Decorators:
    @BaseUrl(String)
    @DefaultHeaders(Object)

- Method Decorators:
    @GET(url: String)
    @POST(url: String)
    @PUT(url: String)
    @DELETE(url: String)
    @Headers(object)
    @Produces(MediaType)

- Parameter Decorators:
    @Path(string)
    @Query(string)
    @Header(string)
    @Body
*/


import { Inject } from '@angular/core';
import {
  Http,
  RequestOptions,
  Request,
  Response,
  RequestMethod,
  Headers as AngularHeaders
} from '@angular/http';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/map';

/**
* Angular 2 RESTClient class.
*
* @class RESTClient
* @constructor
*/
export class RESTClient {

  public constructor( @Inject(Http) protected http: Http) {
  }

  protected getBaseUrl(): string {
    return null;
  }

  protected getDefaultHeaders(): Object {
    return null;
  }

  /**
  * Request Interceptor
  *
  * @method requestInterceptor
  * @param {Request} req - request object
  */
  protected requestInterceptor(req: Request) {
    //
  }

  /**
  * Response Interceptor
  *
  * @method responseInterceptor
  * @param {Response} res - response object
  * @returns {Response} res - transformed response object
  */
  protected responseInterceptor(res: Observable<any>): Observable<any> {
    return res;
  }

}

/**
 * Set the base URL of REST resource
 * @param {String} url - base URL
 */
export function BaseUrl(url: string) {
  return function <TFunction extends Function>(Target: TFunction): TFunction {
    Target.prototype.getBaseUrl = function () {
      return url;
    };
    return Target;
  };
}

/**
 * Set default headers for every method of the RESTClient
 * @param {Object} headers - deafult headers in a key-value pair
 */
export function DefaultHeaders(headers: any) {
  return function <TFunction extends Function>(Target: TFunction): TFunction {
    Target.prototype.getDefaultHeaders = function () {
      return headers;
    };
    return Target;
  };
}

function paramBuilder(paramName: string) {
  return function (key: string) {
    return function (target: RESTClient, propertyKey: string | symbol, parameterIndex: number) {
      const metadataKey = `${propertyKey}_${paramName}_parameters`;
      const paramObj: any = {
        key: key,
        parameterIndex: parameterIndex
      };
      if (Array.isArray(target[metadataKey])) {
        target[metadataKey].push(paramObj);
      } else {
        target[metadataKey] = [paramObj];
      }
    };
  };
}

/**
 * Path variable of a method's url, type: string
 * @param {string} key - path key to bind value
 */
export const Path = paramBuilder('Path');
/**
 * Query value of a method's url, type: string
 * @param {string} key - query key to bind value
 */
export const Query = paramBuilder('Query');
/**
 * Body of a REST method, type: key-value pair object
 * Only one body per method!
 */
export const Body = paramBuilder('Body')('Body');
/**
 * Custom header of a REST method, type: string
 * @param {string} key - header key to bind value
 */
export const Header = paramBuilder('Header');


/**
 * Set custom headers for a REST method
 * @param {Object} headersDef - custom headers in a key-value pair
 */
export function Headers(headersDef: any) {
  return function (target: RESTClient, propertyKey: string, descriptor: any) {
    descriptor.headers = headersDef;
    return descriptor;
  };
}


/**
 * Defines the media type(s) that the methods can produce
 * @param MediaType producesDef - mediaType to be parsed
 */
export function Produces(producesDef: MediaType) {
  return function (target: RESTClient, propertyKey: string, descriptor: any) {
    descriptor.isJSON = producesDef === MediaType.JSON;
    return descriptor;
  };
}


/**
 * Supported @Produces media types
 */
export enum MediaType {
  JSON
}


function methodBuilder(method: number) {
  return function (url: string) {
    return function (target: RESTClient, propertyKey: string, descriptor: any) {

      const pPath = target[`${propertyKey}_Path_parameters`];
      const pQuery = target[`${propertyKey}_Query_parameters`];
      const pBody = target[`${propertyKey}_Body_parameters`];
      const pHeader = target[`${propertyKey}_Header_parameters`];

      descriptor.value = function (...args: any[]) {

        // Body
        let body = null;
        if (pBody) {
          body = JSON.stringify(args[pBody[0].parameterIndex]);
        }

        // Path
        let resUrl: string = url;
        if (pPath) {
          for (const k in pPath) {
            if (pPath.hasOwnProperty(k)) {
              resUrl = resUrl.replace('{' + pPath[k].key + '}', args[pPath[k].parameterIndex]);
            }
          }
        }

        // Query
        const search = new URLSearchParams();
        if (pQuery) {
          pQuery
            .filter(p => args[p.parameterIndex]) // filter out optional parameters
            .forEach(p => {
              const key = p.key;
              let value = args[p.parameterIndex];
              // if the value is a instance of Object, we stringify it
              if (value instanceof Object) {
                value = JSON.stringify(value);
              }
              search.set(encodeURIComponent(key), encodeURIComponent(value));
            });
        }

        // Headers
        // set class default headers
        const headers = new AngularHeaders(this.getDefaultHeaders());
        // set method specific headers
        for (const k in descriptor.headers) {
          if (descriptor.headers.hasOwnProperty(k)) {
            headers.append(k, descriptor.headers[k]);
          }
        }
        // set parameter specific headers
        if (pHeader) {
          for (const k in pHeader) {
            if (pHeader.hasOwnProperty(k)) {
              headers.append(pHeader[k].key, args[pHeader[k].parameterIndex]);
            }
          }
        }

        // Request options
        const options = new RequestOptions({
          method,
          url: this.getBaseUrl() + resUrl,
          headers,
          body,
          search
        });

        const req = new Request(options);

        // intercept the request
        this.requestInterceptor(req);
        // make the request and store the observable for later transformation
        let observable: Observable<Response> = this.http.request(req);

        // transform the obserable in accordance to the @Produces decorator
        if (descriptor.isJSON) {
          observable = observable.map(res => res.json());
        }

        // intercept the response
        observable = this.responseInterceptor(observable);

        return observable;
      };

      return descriptor;
    };
  };
}

/**
 * GET method
 * @param {string} url - resource url of the method
 */
export const GET = methodBuilder(RequestMethod.Get);
/**
 * POST method
 * @param {string} url - resource url of the method
 */
export const POST = methodBuilder(RequestMethod.Post);
/**
 * PUT method
 * @param {string} url - resource url of the method
 */
export const PUT = methodBuilder(RequestMethod.Put);
/**
 * DELETE method
 * @param {string} url - resource url of the method
 */
export const DELETE = methodBuilder(RequestMethod.Delete);
/**
 * HEAD method
 * @param {string} url - resource url of the method
 */
export const HEAD = methodBuilder(RequestMethod.Head);
