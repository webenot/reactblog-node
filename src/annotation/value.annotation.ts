import { getMetadataStorage } from 'class-validator';

export function value (key: string = '') {
  return (target: any, propertyKey: string | symbol, parameterIndex: number) => {
    const values = Reflect.getMetadata('values', target.constructor, propertyKey) || [];
    const types = Reflect.getMetadata('design:paramtypes', target, propertyKey);
    const Type = types[parameterIndex];
    const isRequired = Type && getMetadataStorage()
      .getTargetValidationMetadatas(Type, '', true, true).length > 0;

    values[parameterIndex] = [key, Type, isRequired];

    Reflect.defineMetadata('values', values, target.constructor, propertyKey);
  };
}
