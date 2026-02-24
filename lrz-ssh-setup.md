# SSH Setup for LRZ Linux Cluster (CoolMUC-4)

## The Core Problem: 2FA

Every SSH connection to the LRZ Linux Cluster requires interactive two-factor
authentication (TOTP, push notification, or YubiKey touch). This means Claude
Code can't just SSH in on its own — it would get stuck at the 2FA prompt every
single time.

## The Solution: SSH Multiplexing (ControlMaster)

Open one SSH connection yourself (handling 2FA once), then let all of Claude
Code's subsequent SSH commands piggyback on that already-authenticated
connection — no re-auth needed.

### Step 1: Set up your SSH auth and 2FA stuff

See LRZ docs -- get TANs or a TOTP token at https://simmfa.sim.lrz.de/

### Step 2: Configure SSH multiplexing

Add this to `~/.ssh/config` on your local machine:

```
Host lrz
    HostName cool.hpc.lrz.de
    User <your_lrz_id>

    # Multiplexing — this is what actually matters
    ControlMaster auto
    ControlPath ~/.ssh/sockets/%r@%h-%p
    ControlPersist 8h

    ServerAliveInterval 60
    ServerAliveCountMax 5
```

Then create the socket directory:

```bash
mkdir -p ~/.ssh/sockets
```

### Step 3: Open the tunnel manually (once per work session)

```bash
ssh lrz
```

You'll enter your passphrase + 2FA this one time. Leave this terminal open (or
it persists in the background for 8 hours thanks to `ControlPersist`).

### Step 4: Claude Code can now freely access the cluster

With the master connection alive, any `ssh lrz <command>` call works instantly
with zero interactive prompts. Claude Code can:

| Task | Command |
|---|---|
| Submit a job | `ssh lrz "cd /path/to/work && sbatch job.sh"` |
| Check job status | `ssh lrz "squeue -u $USER"` |
| Upload files | `scp script.R lrz:/path/to/project/` |
| Download results | `scp lrz:/path/to/results/output.rds ./` |
| Run quick commands | `ssh lrz "module load r && Rscript -e 'sessionInfo()'"` |

All of these reuse the authenticated master connection — no password, no 2FA.
