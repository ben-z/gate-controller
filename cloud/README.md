## Development

```bash
pip install -r requirements.txt
python main.py
```

## Deployment

Install [flyctl](https://fly.io/docs/getting-started/installing-flyctl/)

```bash
fly volumes ls
# fly volumes create app_data --region sea --size 1 # if it doesn't already exist
fly deploy
```
