## Development

```bash
pip install -r requirements.txt
```

```bash
flask --app main.py --debug run --port 8081
```

## Deployment

Install [flyctl](https://fly.io/docs/getting-started/installing-flyctl/)

```bash
fly volumes ls
# fly volumes create app_data --region sea --size 1 # if it doesn't already exist
fly deploy
```
