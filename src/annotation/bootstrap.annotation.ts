import { Injectable } from '@reactblog/core/annotations';
import { Container } from '@reactblog/core/container';

export function Bootstrap (target: any) {
  Injectable(target);

  const container = new Container();
  container.get(target);
}
