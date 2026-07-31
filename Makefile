.PHONY: bootstrap api database seed lint test contract-check

bootstrap:
	./scripts/bootstrap.sh

api:
	cd services/api && pnpm dev

database:
	docker compose -f infra/docker-compose.yml up -d postgres

seed:
	cd services/api && pnpm db:migrate && pnpm seed

lint:
	./scripts/lint.sh

test:
	./scripts/test.sh

contract-check:
	cd services/api && pnpm contract:check
