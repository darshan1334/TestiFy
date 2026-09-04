import httpx
import asyncio
import websockets
import json
import sys

async def main():
    async with httpx.AsyncClient() as client:
        # 1. Health
        h = await client.get('http://127.0.0.1:8000/api/health')
        print(f"1. Health Check: {h.status_code} - {h.json()}")

        # 2. Start Test
        resp = await client.post('http://127.0.0.1:8000/api/sessions', json={'url': 'https://example.com', 'max_pages': 3})
        print(f"2. Start Test: {resp.status_code} - {resp.json()}")
        session_id = resp.json()['id']

    # 3. Stream WebSocket
    ws_url = f"ws://127.0.0.1:8000/api/sessions/ws/{session_id}"
    print(f"3. Connecting to {ws_url}...")
    
    async with websockets.connect(ws_url) as ws:
        while True:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=45.0)
                data = json.loads(raw)
                pct = data.get('progress', 0)
                phase = data.get('phase', 'unknown')
                msg = data.get('message', '')
                print(f"   -> Progress: {pct}% | Phase: {phase} | Message: {msg}")
                if phase in ('completed', 'failed'):
                    break
            except asyncio.TimeoutError:
                print("   WS Timeout waiting for messages.")
                break

    # 4. Verification of database record
    async with httpx.AsyncClient() as client:
        res = await client.get(f"http://127.0.0.1:8000/api/sessions/{session_id}")
        data = res.json()
        print(f"4. Verified Final Session from SQLite:")
        print(f"   - Status: {data.get('status')}")
        print(f"   - Pages Crawled: {data.get('pages_crawled')}")
        print(f"   - Total Issues: {data.get('total_issues')}")
        print(f"   - Overall Health: {data.get('overall_health')}")
        print(f"   - Performance Score: {data.get('performance_score')}")
        print(f"   - Accessibility Score: {data.get('accessibility_score')}")
        print(f"   - Issues in DB: {len(data.get('issues', []))}")

if __name__ == '__main__':
    asyncio.run(main())
