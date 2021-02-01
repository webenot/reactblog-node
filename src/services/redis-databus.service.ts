import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { v4 } from 'uuid';

import { Injectable, resolve } from '@reactblog/core/annotations';
import { Exception } from '@reactblog/core/exception';

import { ContextInterface } from '../context';
import { RouteService } from './route.service';
import { Response } from '../response';
import { DatabusService } from './abstracts/databus.service';

export const BROADCAST_CHANNEL = 'BROADCAST_CHANNEL';

export interface IRequest {
  pattern: string;
  ctx: ContextInterface;
  meta: {
    serviceName: string;
    clientId: string;
    responseId: string;
    responseChannel: string;
  }
}

export interface IResponse {
  status: number;
  body: any;
  meta: {
    responseId: string;
  }
}

@Injectable
export class RedisDatabusService extends DatabusService {

  public static readonly RESPONSE_TIMEOUT = 30;
  public readonly sender = new Redis(process.env.REDIS_URL);
  public readonly listener = new Redis(process.env.REDIS_URL);
  public readonly clientId: string = v4();
  private readonly emitter = new EventEmitter();
  private readonly responseSuffix: string = v4();
  private readonly responseRegExp = new RegExp(this.responseSuffix + '$');

  @resolve
  private readonly routeService: RouteService;

  constructor (public readonly serviceName: string) {
    super();
  }

  public init () {
    const channels = [ this.serviceName, this.clientId, BROADCAST_CHANNEL ];
    this.subscribe(...channels);
  }

  public listen () {
    this.listener.on('message', this.handle);
    console.log('Redis starts listen');
  }

  public send (channelName: string, pattern: string, ctx: ContextInterface): Promise<any> {
    return new Promise((resolve, reject) => {
      const request: IRequest = {
        ctx,
        meta: {
          clientId: this.clientId,
          responseChannel: `${this.clientId}-${this.responseSuffix}`,
          responseId: v4(),
          serviceName: this.serviceName,
        },
        pattern,
      };

      const timeout = setTimeout(() => {
        this.emitter.removeAllListeners(request.meta.responseId);
        reject(new Exception('timeout', 408));
      }, RedisDatabusService.RESPONSE_TIMEOUT * 1000);

      this.emitter.once(request.meta.responseId, data => {
        clearTimeout(timeout);
        resolve(data);
      });

      this.sender.publish(channelName, JSON.stringify(request));
    });
  }

  public subscribe (...channels: string[]): void {
    const chnls = [ ...channels, channels.map(c => `${c}-${this.responseSuffix}`) ];
    this.listener.subscribe(...chnls as any);
  }

  private handle = (channel: string, data: string) => {
    const body = JSON.parse(data);

    if (this.responseRegExp.test(channel)) {
      this.response(body);
    } else {
      this.request(body);
    }
  };

  private response (response: IResponse) {
    this.emitter.emit(response.meta.responseId, new Response(response.status, response.body));
  }

  private async request (request: IRequest) {
    const response: any = await this.routeService.run(
      request.pattern,
      {
        ...request.ctx,
        meta: request.meta,
      },
    );
    response.meta = { responseId: request.meta.responseId };
    this.sender.publish(request.meta.responseChannel, JSON.stringify(response));
  }
}
