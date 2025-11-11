// services/cacheService.js
const redis = require('redis');

class CacheService {
  constructor() {
    this.client = redis.createClient({
      url: process.env.REDIS_URL
    });
    
    this.client.on('error', (err) => console.log('Redis Client Error', err));
    this.client.connect();
  }

  async get(key) {
    return await this.client.get(key);
  }

  async set(key, value, expiration = 3600) {
    await this.client.set(key, value, {
      EX: expiration
    });
  }

  async delete(key) {
    await this.client.del(key);
  }

  async deletePattern(pattern) {
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(keys);
    }
  }
}

module.exports = new CacheService();