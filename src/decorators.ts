import { Constructable, Container } from 'typedi';
import { EntityTarget } from 'typeorm';
import { AppDataSource } from './data-source';
import { createLogger } from './logger';

export const InjectLogger =
  <T>(category: string) =>
  (object: Constructable<T>, propertyName: string, index?: number) => {
    Container.registerHandler({
      object,
      propertyName,
      index,
      value: () => createLogger(category),
    });
  };

export const InjectEntityManager =
  <T>() =>
  (object: Constructable<T>, propertyName: string, index?: number) => {
    Container.registerHandler({
      object,
      propertyName,
      index,
      value: () => AppDataSource.manager,
    });
  };

export const InjectRepository =
  <E, C>(entity: EntityTarget<E>) =>
  (object: Constructable<C>, propertyName: string, index?: number) => {
    Container.registerHandler({
      object,
      propertyName,
      index,
      value: () => AppDataSource.manager.getRepository(entity),
    });
  };
