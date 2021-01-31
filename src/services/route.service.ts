import { Injectable } from '@reactblog/core/annotations';
import { ClassType } from '@reactblog/core/class.type';
import { Exception } from '@reactblog/core/exception';
import { CONTAINER_CONTEXT } from '@reactblog/core/container';
import { ContextInterface } from '../context';
import { Response } from '../response';

export interface IResult {
  status: number;
  body?: any;
}

interface IParam {
  attr: string;
  key: string;
}

export interface IPattern {
  pattern: string;
  regexp?: RegExp;
  keyParams?: IParam[];
  Controller: ClassType;
  methodName: string;
}

@Injectable
export class RouteService {

  private static controllers: any = [];
  private patterns: IPattern[] = [];

  public static register (Target: ClassType) {
    if (this.controllers.indexOf(Target) === -1) {
      this.controllers.push(Target);
    }
  }

  public getPatterns (): IPattern[] {
    return this.patterns;
  }

  public init () {
    this.prepareRoutes();
  }

  public async run (pattern: string, ctx: ContextInterface = {}): Promise<IResult> {
    const response: IResult = {
      status: 200,
      body: null,
    };

    try {
      const result = await this.execute(pattern, ctx);
      if (result instanceof Response) {
        response.status = result.status;
        response.body = result.body;
      } else {
        response.body = result;
      }
    } catch (e) {
      console.log(e);
      response.status = e.code || 500;
      const message = !e.code && process.env.NODE_ENV === 'production' ? 'Oops, try again later' : e.message;
      response.body = { message };

      if (e.errors) {
        response.body.errors = e.errors;
      }
    }

    return response;
  }

  public prepareRoutes (): void {
    this.patterns = [];
    RouteService.controllers
      .forEach((Controller: any) => {
        const endpoints = Reflect.getMetadata('endpoints', Controller);
        const metadata = Reflect.getMetadata('metadata', Controller) || {};

        Object.keys(endpoints)
          .forEach(methodName => {
            let { pattern } = endpoints[methodName];

            if (metadata.basePath) {
              const [ method, ...rest ] = pattern.split(' ');
              pattern = `${method} ${metadata.basePath}${rest.join()}`;
            }

            const params: IPattern = {
              pattern,
              Controller,
              methodName,
            };

            if (pattern.match(/<(.*?):(.*?)>/)) {
              params.keyParams = [];
              const r = pattern.replace(/<(.*?):(.*?)>/ig, (_: string, attr: string, key: string) => {
                params.keyParams.push({
                  attr,
                  key,
                });
              });
              params.regexp = new RegExp(r);
            }

            this.patterns.push(params);
          });
      });

    this.patterns.sort((a: IPattern) => a.regexp ? 1 : -1);
  }

  private async execute (pattern: string, ctx: ContextInterface): Promise<any> {
    const el = this.patterns.find(item => {
      return (!item.regexp && item.pattern === pattern) ||
        (item.regexp && item.regexp.test(pattern));
    });

    if (!el) {
      throw new Exception(`Pattern "${pattern}" not found`, 404);
    }

    if (el.regexp) {
      if (!ctx.params) {
        ctx.params = {};
      }

      const result = el.regexp.exec(pattern);
      el.keyParams.forEach(({ attr }, index) => {
        ctx.params[attr] = result[index + 1];
      });
    }

    // @ts-ignore
    return this[CONTAINER_CONTEXT].get(el.Controller)[el.methodName](ctx);
  }
}
