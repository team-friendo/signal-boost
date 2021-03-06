# Playbook: migrating to a new server

Steps for migrating signalboost from an old server (`sb1`) to a new one (`sb2`):

- [ ] hosting-provider-specific tweaks (if needed)
  - [ ] install OS and set up ssh keys
  - [ ] set docker DNS configs a per: https://github.com/moby/moby/issues/32106#issuecomment-382228854
    - [ ] discover provider-specific nameservers with `cat /etc/resolv.conf` (or retrieve from web console)
    - [ ] add custom nameservers to `/etc/docker/daemon.json`: `{ "dns": [<ns1>, <ns2>, "1.1.1.1" }`
    - [ ] restart docker with `systemctl restart docker`
    - [ ] bonus: script this and add it to `ansible/playbooks/provision.yml` !!!
- [ ] provision sb2
  - [ ] edit `ansible/inventory` to point to sb2 (provide sb2's IP address under `signalboost.hosts`)
  - [ ] `make ansible.provision`
  - [ ] `make ansible.provision.backup.source`
  - [ ] `make ansible.harden`
  - [ ] `make ansible.deploy.friendo`
- [ ] move data
  - [ ] edit `inventory` to point to sb1, run `make ansible.backup`
  - [ ] turn off sb1
  - [ ] edit `inventory` to point to sb2, run `make ansible.restore`
- [ ] QA
  - [ ] verify restored data is present -- on sb2:
    - [ ] ssh onto sb2
    - [ ] check keystore present with: `ls -al /var/lib/docker/volumes/signalboost_signal_data/_data` (should show lots of files)
    - [ ] check db data present with: `make prod.psql` -> `select count(*) from memberships;`
  - [ ] verify application logic works -- from local machine:
    - [ ] edit DNS records for api, signald-0...9 to point to sb2 (so that LE works properly in next step)
    - [ ] run `./bin/restart` from sb2 or `make ansible.restart` from la(should restart app)
    - [ ] send `INFO` to DIAGNOSTICS channel (should get response)
    - [ ] edit `.env` to point `SIGNALBOOST_HOST_URL` and `SIGNALBOOST_HOST_IP` to sb2's host/ip
    - [ ] run `boost list-channels` (should see channels restored from backup above)
  - [ ] verify backups work:
    - [ ] on sb2: `cat /etc/crontab` (should show backup job)
    - [ ] from local machine: run `make ansible.backup` (should run backup)
    - [ ] from backup server: `ls -al /srv/backups` (should show backup)
- [ ] wipe sb1
  - [ ] clear data with `docker volume prune`
  - [ ] delete/comment backup job in `/etc/crontab`
- [ ] finishing touches
  - [ ] commit changes to .env in blackbox
  - [ ] submit MR
  - [ ] write the team
