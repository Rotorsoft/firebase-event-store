'use strict'

/**
 * Simple in-memory object cache
 */
module.exports = class SimpleCache {
  constructor(size = 10) {
    this._size_ = size
    this._cache_ = new Map()
  }

  get (key) {
    if (!this._size_) return null

    const item = this._cache_.get(key)
    if (item) {
      this._cache_.delete(key)
      this._cache_.set(key, item)
    }
    return item
  }

  set (key, item) {
    if (!this._size_) return

    if (this._cache_.has(key)) this._cache_.delete(key)
    this._cache_.set(key, item)

    while (this._cache_.size > this._size_) {
      const first = this._cache_.keys().next().value
      this._cache_.delete(first)
    }
  }
}
