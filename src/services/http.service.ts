import http from 'http';
import url from 'url';
import qs from 'qs';

import { Injectable, resolve } from '@reactblog/core/annotations';
import { RouteService } from './route.service';
import { ContextInterface } from '../context';

@Injectable
export class HttpService {

  @resolve
  private routeService: RouteService;

  private readonly server = http.createServer();

  init () {
    this.on('request', async (request, response) => {
      const parsedUrl = url.parse(request.url);
      const context: ContextInterface = {
        query: qs.parse(parsedUrl.query)
      };
      const pattern = `${request.method} ${parsedUrl.pathname}`;
      const { status, body } = await this.routeService.run(pattern, context);
      response.statusCode = status;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(body));
    });
  }

  on (eventName: string, fn: (request: http.IncomingMessage, response: http.ServerResponse) => void) {
    console.log(eventName);
    this.server.on(eventName, fn);
  }

  async listen (port: number = 8017, host: string = '0.0.0.0'): Promise<void> {
    return new Promise(resolve => {
      this.server.listen(port, host, () => {
        console.log(`Server listen ${port} port`);
        resolve();
      });
    });
  }
}
