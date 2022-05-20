## Run

```
npm install
cp .env.example .env
npm run start
```

## Config

Create `.env` file in the working directory:

```
LOG_LEVEL=info

AWS_ACCESS_KEY_ID=<Your AWS access key ID here>
AWS_SECRET_ACCESS_KEY=<Your AWS access key secret here>
AWS_REGION=eu-central-1
AWS_BUCKET=near-lake-data-testnet

DATABASE_TYPE=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5437
DATABASE_USERNAME=indexer
DATABASE_PASSWORD=indexer
DATABASE_NAME=indexer

START_BLOCK_HEIGHT=90260122
FETCH_MAX_KEYS=10
WAIT_FOR_NEW_BLOCKS=2000

TRACK_ACCOUNTS=sputnikv2.testnet
```
