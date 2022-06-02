## Run

Install packages:

```
npm install
```

Create config from example

```
cp .env.example .env
```

Sync database schema:

```
npm run schema:sync
```

Run migrations:

```
npm run migration:run
```

Run:
```
npm run start
```

You can use `npm run start:debug` or `npm run start:trace` for verbose output.

### CLI helper

To download and output raw block data in JSON format:

```
npm run cli 12345
```
