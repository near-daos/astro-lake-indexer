export default class Cache<K, V> extends Map<K, V> {
  constructor(private readonly maxSize: number) {
    super();
  }

  set(key: K, value: V): this {
    super.set(key, value);
    if (this.size > this.maxSize) {
      this.delete(this.keys().next().value);
    }
    return this;
  }
}
