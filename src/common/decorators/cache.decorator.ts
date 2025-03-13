import { CacheService } from '../services/cache.service';

export function Cached(prefix: string = '', ttl?: number) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheService = this.cacheService as CacheService;
      if (!cacheService) {
        console.warn('CacheService not found, skipping cache');
        return originalMethod.apply(this, args);
      }

      const cacheKey = `${prefix}:${propertyKey}:${JSON.stringify(args)}`;
      const cached = cacheService.get(cacheKey);

      if (cached !== null) {
        return cached;
      }

      const result = await originalMethod.apply(this, args);
      cacheService.set(cacheKey, result, ttl);

      return result;
    };

    return descriptor;
  };
}

export function InvalidateCache(prefix: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);

      const cacheService = this.cacheService as CacheService;
      if (cacheService) {
        cacheService.invalidateByPrefix(prefix);
      }

      return result;
    };

    return descriptor;
  };
}
