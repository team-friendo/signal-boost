# We need to use bash, not 'sh' (which is bash on osx and something else on linux)
SHELL := /bin/bash

help:  ## print this message
# borrowed from: https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
	@grep -E '^[a-zA-Z_\.-]+:' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":[^#]*(## )?"}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2 }'

###########################
# local workflow commands #
###########################


_.setup: # build docker container, create dbs, run migrations
	./bin/dev/setup

_.update: # re-build docker images, install dependencies, run migrations
	./bin/dev/setup

_.unlock: ## unlock signalboost secrets
	./bin/blackbox/decrypt_all_files


########################
# cli-related commands #
########################

cli.install: ## install the boost cli (puts ./cli/boost-commands on your $PATH)
	sudo ./cli/install

cli.uninstall: ## removes boost cli files from your path
	sudo ./cli/uninstall

# TODO: add aliases to commands here that accept args...


##################
# docker-related #
##################

docker.build.signalboost: ## build the signalboost docker image (accepts optional TAG=#.#.# argument)
	./bin/docker-build signalboost $(TAG)

docker.build.signald: ## build the signald docker image (accepts optional TAG=#.#.# argument)
	./bin/docker-build signald $(TAG)

docker.push.signalboost: ## push the signalboost docker image (accepts optional TAG=#.#.# argument)
	./bin/docker-push signalboost $(TAG)

docker.push.signald: ## push the signald docker image (accepts optional TAG=#.#.# argument)
	./bin/docker-push signald $(TAG)

###################
# ansible-related #
###################

ansible.install: ## removes boost cli files from your path
	./ansible/install-ansible

ansible.deploy: # deploy the app to prod
	./bin/deploy

ansible.deploy.friendo: # deploy the app to prod
	FRIENDO_DEPLOY=1 ./bin/deploy

ansible.deploy_metrics: # deploy grafana/prometheus to metrics server
	./bin/deploy-metrics

ansible.provision: # deploy the app to prod
	cd ansible && ansible-playbook -i inventory playbooks/provision.yml

ansible.provision_backup_src: # deploy the app to prod
	cd ansible && ansible-playbook -i inventory playbooks/provision_backup_src.yml

ansible.provision_backup_dst: # deploy the app to prod
	cd ansible && ansible-playbook -i inventory playbooks/provision_backup_dst.yml

ansible.harden: # deploy the app to prod
	cd ansible && ansible-playbook -i inventory playbooks/harden.yml

ansible.backup: # backup the app from prod to sb_backup host
	cd ansible && ansible-playbook -i inventory playbooks/backup.yml

ansible.restore: # restore from backup on sb_backup host to prod
	cd ansible && ansible-playbook -i inventory playbooks/restore.yml

ansible.restart: # restart prod
	cd ansible && ansible-playbook -i inventory playbooks/restart.yml


#######################
# db-related commands #
#######################

db.drop: # drop db
	./bin/dev/drop

db.psql: # get a psql shell on dev db
	./bin/dev/psql

db.migrate.up: # run all migrations
	./bin/dev/migrate

db.migrate.down: # undo last migration
	./bin/dev/migrate-undo

db.migrate.status: # check migration statuses
	./bin/dev/migrate-status


##########################
# start and stop the app #
##########################

dev.up: ## run signalboost in local dev mode
	docker-compose -f docker-compose-dev.yml up -d ngrok app

dev.up.v: ## run signalboost in local dev mode with verbose logging
	SIGNALBOOST_VERBOSE_LOG=1 docker-compose -f docker-compose-dev.yml up -d ngrok app

dev.up.metrics: ## run signalboost in local dev mode with prometheus/grafana
	docker-compose -f docker-compose-dev.yml up -d

dev.down: ## gracefully stop all signalboost container
	docker-compose -f docker-compose-dev.yml down

dev.abort: ## force stop all running signalboost containers
	docker ps --filter name=signalboost_* -aq | xargs -I container_id docker rm -f container_id

dev.logs: ## show logs for all docker containers
	docker-compose -f docker-compose-dev.yml logs -f

dev.restart: ## force stop and start the app again
	docker ps --filter name=signalboost_* -aq | xargs -I container_id docker rm -f container_id && \
	docker-compose -f docker-compose-dev.yml up -d ngrok app

dev.restart.v: ## force stop and start the app again with verbose loggins
	docker ps --filter name=signalboost_* -aq | xargs -I container_id docker rm -f container_id && \
	SIGNALBOOST_VERBOSE_LOG=1 docker-compose -f docker-compose-dev.yml up -d ngrok app

dev.restart.metrics: ## force stop and start the app again (with prometheus/grafana)
	docker ps --filter name=signalboost_* -aq | xargs -I container_id docker rm -f container_id && \
	docker-compose -f docker-compose-dev.yml up -d

#############
# run tests #
#############

test.all: ## run all unit and e2e tests
	npx eslint app && ./bin/test/unit && ./bin/test/integration && ./bin/test/e2e

test.unit: ## run unit tests
	./bin/test/unit

test.integration: ## run integration tests
	./bin/test/integration

test.e2e: ## run e2e tests
	./bin/test/e2e

test.lint: ## run linter
	npx eslint app && npx eslint test

test.lint.fix: ## run linter with --fix option to automatically fix what can be
	npx eslint --fix app && npx eslint --fix test



##################################
# run and deploy the splash page #
##################################


splash.setup: ## build dev env for docker site (build docker container, install  npm deps)
	./splash/bin/setup

splash.dev.up: ## run splash site in dev mode
	cd splash && docker-compose -f docker-compose-dev.yml up

splash.dev.down: ## shut down splash dev containers
	cd splash && docker-compose -f docker-compose-dev.yml down

splash.build: ## build production version of splash site
	cd splash && docker-compose run --entrypoint 'gatsby build' splash

splash.prod.up: ## run (already-built) version of splash site
	cd splash && docker-compose up

splash.prod.down: ## shut down splash prod containers
	cd splash && docker-compose down

splash.deploy: ## deploy the splash app
	./splash/bin/deploy

splash.update: ## install new node dependencies and rebuild docker container if needed
	./splash/bin/update
