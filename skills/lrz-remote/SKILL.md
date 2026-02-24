---
name: lrz-remote
description: Manage R-based HPC workflows on the LRZ Linux Cluster (CoolMUC-4) via SSH from the user's local machine. Use this skill whenever the user wants to run R scripts on the LRZ cluster, submit SLURM jobs, install R packages on LRZ, monitor running jobs, fetch results, or set up their LRZ compute environment. Also trigger when the user mentions CoolMUC, LRZ HPC, parallelized R, mclapply on a cluster, SLURM + R, or remote HPC job management. This skill assumes Claude Code is running locally and reaches LRZ through a pre-configured SSH multiplexed connection.
---

# LRZ Remote: R on the LRZ Linux Cluster (CoolMUC-4)

## How This Works

You (Claude Code) are running on the user's laptop. The user has an SSH alias `lrz` configured with ControlMaster multiplexing — meaning a single authenticated session stays open, and all your `ssh lrz "..."` commands piggyback on it with no password prompts.

**You never run computation on the login node.** Everything goes through SLURM batch jobs. The login node is only for file management, job submission, queue inspection, and small setup tasks.

## Prerequisites — Verify Before Doing Anything

Before your first remote command, verify the connection is alive:

```bash
ssh lrz "hostname"
```

If this hangs or errors, tell the user:
> "Your SSH tunnel to LRZ doesn't seem to be active. Please open a terminal and run `ssh lrz` to authenticate (you'll need your password + 2FA). Leave that session open, then come back here."

## User Configuration

The user MUST provide the following before you can do real work. If any are missing, ask for them.

| Setting | Example | How to discover |
|---|---|---|
| LRZ username | `rs86ghi2` | Given |
| SSH alias | `lrz` | Check `~/.ssh/config` |
| Home directory | `/dss/dsshome1/lxc04/rs86ghi2` | `ssh lrz "echo \$HOME"` |
| Work/scratch directory | `/dss/dssfs04/...` or similar | `ssh lrz "echo \$SCRATCH_DSS \$WORK"` |
| Project account (if needed) | `pn12ab` | `ssh lrz "sacctmgr show assoc user=\$USER format=Account -n"` |
| Email for SLURM notifications | `bla.blub@stat.uni-muenchen.de` | Ask user |

Store these in a local project file (e.g., `.lrz_config`) so you don't have to re-ask.

## Local ↔ Remote Directory Convention

Local project directories and their LRZ counterparts **share the same folder name** and are typically clones of the same git repository. Example:

- Local: `~/myproject/`
- Remote: `~/myproject/` (same name, under the LRZ home)

**Prefer `git pull` over `scp` to sync script changes** when both sides are git clones — it's cleaner and keeps history intact. Use `scp` only for data files or when the LRZ copy isn't a git repo.

```bash
# Sync R script changes via git (preferred)
# local: git push
# then: ssh lrz "cd ~/myproject && git pull"

# Fallback: scp a specific file
scp local_script.R lrz:~/myproject/scripts/
```

## The R Environment on LRZ

### Loading R

R is available through the module system. Always load `slurm_setup` first in batch scripts:

```bash
module load slurm_setup
module load r          # loads default R version
```

To discover available R versions:
```bash
ssh lrz "module av r 2>&1 | grep -Ei '^\s*r/[0-9]'"
```

Modules follow the pattern `r/<version>-<compiler>-mkl`, e.g., `r/4.3.3-gcc13-mkl`. The MKL-linked versions give better linear algebra performance. **Always use the explicit versioned name** (e.g., `module load r/4.3.3-gcc13-mkl`) rather than `module load r`. The `-gcc13-mkl` variant already bundles gcc — no separate gcc load/unload needed.

### Installing R Packages

Package installation is lightweight — run it on the login node via SSH. **Use `pak::pkg_install()`, not `install.packages()`**: `pak` handles dependency version conflicts correctly when older package versions are already loaded in the R session; `install.packages()` can silently install to the wrong library or fail with namespace conflicts.

**Step 1: Discover the active user library** — do this before creating any directories or editing `.Rprofile`. The user may already have a working setup, possibly with a versioned library path from an older R installation.

```bash
# Check for existing .Rprofile and actual .libPaths()
ssh lrz "cat ~/.Rprofile 2>/dev/null || echo 'No .Rprofile'"
ssh lrz 'module load slurm_setup && module load r/<VERSION>-gcc13-mkl && Rscript -e ".libPaths()"'
```

The first writable path in `.libPaths()` is where packages will be installed. Use that path explicitly with `-lib`. **Do not overwrite an existing `.Rprofile`** — append to it only if the user library path is missing.

**Step 2: Install packages with `pak`**

```bash
ssh lrz 'module load slurm_setup && module load r/<VERSION>-gcc13-mkl && \
  Rscript -e "pak::pkg_install(c(\"data.table\", \"future\", \"future.apply\"), \
              lib=\"~/R/x86_64-pc-linux-gnu-library/<MAJOR.MINOR>\", ask=FALSE)"'
```

Replace `<VERSION>` with the full module version (e.g., `4.3.3-gcc13-mkl`) and `<MAJOR.MINOR>` with the R major.minor version (e.g., `4.3`). If `pak` is not yet installed, install it first with `install.packages("pak")`.

**Watch out:** If `.Rprofile` puts a versioned library directory (e.g., `4.4/`) first in `.libPaths()` from a previous R installation that's no longer available, that directory takes precedence. Install packages there, not to the current R version's default path.

For packages with system dependencies (like `sf`, `terra`), you may need additional modules:
```bash
ssh lrz "module av 2>&1 | grep -i <depname>"
```

## Submitting SLURM Jobs

### Choosing a Partition

| Partition | Use case | Nodes shared? | Max cores/job | Max time |
|---|---|---|---|---|
| `serial_std` | Small R jobs (1-few cores) | Yes (shared) | Limited | 48h |
| `serial_long` | Long-running small jobs | Yes (shared) | Limited | 96h+ |
| `cm4_tiny` | Multi-core, single-node | Yes (shared) | up to full node | 24-48h |
| `cm4_std` | Full-node exclusive | No (exclusive) | full node | 48h |
| `cm4_inter` | Interactive testing | Yes (shared) | varies | short |

**Default recommendation for parallelized R**: Use `serial_std` for jobs needing ≤16 cores, `cm4_tiny` for single-node multi-core jobs needing more, and `cm4_std` only when you truly need a whole node.

### SLURM Job Script Template for R

Every job script you generate should follow this template. Adapt the resource requests to the task.

```bash
#!/bin/bash
#SBATCH -J {{JOB_NAME}}
#SBATCH -o ./logs/%x.%j.out
#SBATCH -e ./logs/%x.%j.err
#SBATCH -D {{WORKING_DIR}}
#SBATCH --get-user-env
#SBATCH --clusters=cm4
#SBATCH --partition={{PARTITION}}
#SBATCH --nodes=1
#SBATCH --ntasks=1
#SBATCH --cpus-per-task={{NCPUS}}
#SBATCH --mem={{MEMORY_MB}}mb
#SBATCH --time={{HH:MM:SS}}
#SBATCH --mail-type=END,FAIL
#SBATCH --mail-user={{EMAIL}}
#SBATCH --export=NONE

# Load modules
module load slurm_setup
module load r/{{R_VERSION}}-gcc13-mkl   # e.g. r/4.3.3-gcc13-mkl

# Run the R script
Rscript {{SCRIPT_PATH}}
```

**Critical rules for SLURM scripts:**
- ALWAYS include `--export=NONE` (LRZ policy — environment should be set up inside the script via modules)
- ALWAYS include `--get-user-env` 
- ALWAYS create the logs directory before submitting: `ssh lrz "mkdir -p {{WORKING_DIR}}/logs"`
- ALWAYS specify `--clusters=cm4` for CoolMUC-4
- Use `--clusters=serial` for the serial partitions
- Set `--mem` explicitly on shared partitions (memory scales with cores by default, which may not be enough)
- LRZ requires `--mail-user` to be set

### The Workflow: Upload → Submit → Monitor → Download

**Step 1: Upload files**
```bash
# Upload R script and any data files
scp local_script.R lrz:~/project/scripts/
scp data.csv lrz:~/project/data/
```

**Step 2: Create and upload job script**
```bash
scp job.slurm lrz:~/project/
```

**Step 3: Submit**
```bash
ssh lrz "cd ~/project && sbatch job.slurm"
# Returns: "Submitted batch job XXXXXX on cluster cm4"
# Save the job ID!
```

To resubmit with a different R script (e.g. after fixing an error) without editing or reuploading the `.slurm` file:
```bash
ssh lrz "cd ~/project && sed 's/old_script/new_script/' job.slurm | sbatch"
```

**Step 4: Monitor**
```bash
# Check queue status
ssh lrz "squeue --clusters=serial -j {{JOB_ID}} 2>/dev/null"
```

**Important**: if the job is no longer in `squeue`, it has already completed (or failed) — this is normal for short jobs. Do not interpret absence from the queue as an error. Immediately check the logs:

```bash
# stdout — R output and progress messages
ssh lrz "cat ~/project/logs/{{JOB_NAME}}.{{JOB_ID}}.out"

# stderr — module load messages appear here even on success; look for R errors/warnings
ssh lrz "grep -v 'Loading\|requirement' ~/project/logs/{{JOB_NAME}}.{{JOB_ID}}.err || true"

# Job accounting (confirms exit code and resource use)
ssh lrz "sacct --clusters=serial -j {{JOB_ID}} --format=JobID,State,ExitCode,Elapsed,MaxRSS"
```

The `.err` log always contains module load lines (e.g. `Loading r/4.3.3-gcc13-mkl`) — these are not errors. A successful job has `ExitCode 0:0` in `sacct` and the expected output in `.out`.

**Step 5: Download results**
```bash
scp lrz:~/project/results/* ./results/
# Or for many files:
scp -r lrz:~/project/results/ ./local_results/
```

## Parallelized R Patterns

### Pattern 1: Single-node multicore (most common)

Use `parallel::mclapply` or `future.apply::future_lapply`. This is the simplest and usually sufficient.

**R script template:**
```r
library(parallel)

# Detect cores allocated by SLURM (not all cores on the node!)
ncores <- as.integer(Sys.getenv("SLURM_CPUS_PER_TASK", unset = "1"))
cat("Using", ncores, "cores\n")

# Your computation
results <- mclapply(1:100, function(i) {
  # expensive computation here
  Sys.sleep(0.1)
  return(i^2)
}, mc.cores = ncores)

# Save results
saveRDS(results, "results/output.rds")
```

**Or with the `future` framework:**
```r
library(future)
library(future.apply)

ncores <- as.integer(Sys.getenv("SLURM_CPUS_PER_TASK", unset = "1"))
plan(multicore, workers = ncores)

results <- future_lapply(1:100, function(i) {
  # expensive computation here
  return(i^2)
})

saveRDS(results, "results/output.rds")
```

### Pattern 2: SLURM Job Arrays (embarrassingly parallel)

When you have many independent tasks (e.g., run the same analysis on 50 datasets), use SLURM job arrays instead of R-level parallelism. This is more efficient and robust.

**Job script:**
```bash
#!/bin/bash
#SBATCH -J array_job
#SBATCH -o ./logs/%x.%A_%a.out
#SBATCH -e ./logs/%x.%A_%a.err
#SBATCH -D /path/to/workdir
#SBATCH --get-user-env
#SBATCH --clusters=serial
#SBATCH --partition=serial_std
#SBATCH --nodes=1
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=1
#SBATCH --mem=4000mb
#SBATCH --time=02:00:00
#SBATCH --mail-type=END,FAIL
#SBATCH --mail-user=user@example.com
#SBATCH --export=NONE
#SBATCH --array=1-50

module load slurm_setup
module load r/{{R_VERSION}}-gcc13-mkl   # e.g. r/4.3.3-gcc13-mkl

Rscript run_task.R $SLURM_ARRAY_TASK_ID
```

**R script (`run_task.R`):**
```r
args <- commandArgs(trailingOnly = TRUE)
task_id <- as.integer(args[1])
cat("Running task", task_id, "\n")

# Load the task-specific data or parameters
# ... do work ...

saveRDS(result, paste0("results/result_", task_id, ".rds"))
```

### Pattern 3: Bundled parallel tasks (many short jobs)

LRZ strongly discourages submitting thousands of small jobs. Instead, bundle them:

```bash
#!/bin/bash
#SBATCH --clusters=cm4
#SBATCH --partition=cm4_tiny
#SBATCH --nodes=1
#SBATCH --ntasks=8
#SBATCH --cpus-per-task=1
#SBATCH --time=04:00:00
# ... other directives ...

module load slurm_setup
module load r

for i in $(seq 1 8); do
  srun -n1 -c1 --exclusive Rscript task.R $i &
done
wait
```

## Monitoring & Troubleshooting

### Common SLURM Commands

```bash
# Your jobs across all clusters
ssh lrz "squeue --clusters=all -u \$USER"

# Estimated start time for pending job
ssh lrz "squeue --clusters=cm4 -j {{JOB_ID}} --start"

# Job history (completed jobs)
ssh lrz "sacct --clusters=cm4 -j {{JOB_ID}} --format=JobID,JobName,State,ExitCode,Elapsed,MaxRSS"

# Cancel a job
ssh lrz "scancel --clusters=cm4 {{JOB_ID}}"

# Cancel all your jobs
ssh lrz "scancel --clusters=cm4 -u \$USER"

# Check disk quota
ssh lrz "quota -s"
```

### Common Issues

| Symptom | Likely cause | Fix |
|---|---|---|
| Job pending forever | Wrong partition or too many resources requested | Check `squeue --start`, reduce resources |
| `module: command not found` | Missing `--get-user-env` or `--export=NONE` mismatch | Ensure both flags are in the job script |
| R package not found | User library not on `.libPaths()` | Check `.Rprofile`, add `.libPaths()` call in script |
| Wrong package version loaded | `.Rprofile` hardcodes a stale versioned lib dir (e.g., `4.4/` when only R 4.3 is available) | Fix `.Rprofile` to use a version-dynamic `.libPaths()` call (see Installing R Packages section) |
| Out of memory (OOM killed) | Didn't request enough `--mem` | Increase `--mem`, check `sacct --format=MaxRSS` |
| Permission denied on output | Output directory doesn't exist | `mkdir -p` before submitting |
| `scp` fails | Outgoing SSH blocked from LRZ | Always `scp` FROM your laptop, never from LRZ |

## Safety Rules

1. **NEVER run heavy computation on the login node.** File management, `pak::pkg_install()`, `.libPaths()` checks, and short `Rscript -e` calls are fine. Simulations, model fitting, and anything CPU/memory-intensive must go through SLURM.
2. **NEVER submit thousands of tiny jobs.** Bundle them or use job arrays.
3. **NEVER use empty SSH key passphrases.** LRZ will ban the account.
4. **ALWAYS use `--export=NONE`** in SLURM scripts.
5. **ALWAYS create output directories** before submitting jobs.
6. **ALWAYS specify `--clusters=`** in SLURM commands — CoolMUC-4 uses `cm4` or `serial`.
