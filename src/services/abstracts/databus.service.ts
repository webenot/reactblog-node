import { Injectable } from '@reactblog/core/annotations';

@Injectable
export abstract class DatabusService {

  public abstract subscribe (...channels: string[]): void;

  public abstract listen (): void;

  public abstract send (channelName: string, pattern: string, message: any): Promise<any>;
}
