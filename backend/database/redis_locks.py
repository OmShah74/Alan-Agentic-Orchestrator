from database.connection import redis_client
import time
from loguru import logger

class DistributedLock:
    def __init__(self, resource_name: str, timeout: int = 30):
        self.lock_key = f"lock:{resource_name}"
        self.timeout = timeout

    def acquire(self) -> bool:
        acquired = redis_client.set(self.lock_key, "locked", nx=True, ex=self.timeout)
        if acquired:
            logger.info(f"Acquired lock on {self.lock_key}")
            return True
        return False

    def release(self):
        redis_client.delete(self.lock_key)
        logger.info(f"Released lock on {self.lock_key}")
        
    def wait_and_acquire(self, max_wait=10) -> bool:
        start = time.time()
        while time.time() - start < max_wait:
            if self.acquire():
                return True
            time.sleep(0.5)
        raise TimeoutError(f"Could not acquire lock for {self.lock_key}")