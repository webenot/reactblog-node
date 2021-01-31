import { Injectable } from '@reactblog/core/annotations';

export function Controller () {
  return (target: any) => {
    Injectable(target);
  };
}
