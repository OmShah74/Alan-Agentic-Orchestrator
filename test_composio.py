import httpx
import asyncio

async def test_composio():
    async with httpx.AsyncClient() as client:
        # Action GITHUB_GET_AUTHENTICATED_USER is a simple generic action to test if auth is working
        payload = {
            "prompt": "Can you check my Github account and tell me my username and what repositories I own using the tool executor?"
        }
        
        response = await client.post("http://localhost:8080/api/v1/task", json=payload, timeout=120.0)
        print("Status Code:", response.status_code)
        
        try:
            print("Response:", response.json())
        except Exception as e:
            print("Response Text:", response.text)

if __name__ == "__main__":
    asyncio.run(test_composio())
