## Getting started

Manual:
```bash
pip install -r requirements.txt
sudo -E python3 main.py
```

Always-on service:
```bash
docker-compose up -d --build
docker-compose logs --tail 10 -f
```
