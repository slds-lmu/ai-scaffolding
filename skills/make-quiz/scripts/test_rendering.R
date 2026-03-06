#!/usr/bin/env Rscript
# Test script to verify all quiz questions render correctly
# Usage: Rscript test_rendering.R [format]
#   format: "moodle" (default) or "html"
#
# Run from the quiz/ root directory. Auto-discovers chapter subdirectories.

library(exams)

args <- commandArgs(trailingOnly = TRUE)
format <- ifelse(length(args) > 0, tolower(args[1]), "moodle")

if (!format %in% c("moodle", "html")) {
  cat("Error: format must be 'moodle' or 'html'\n")
  cat("Usage: Rscript test_rendering.R [format]\n")
  quit(status = 1)
}

# Auto-discover chapter directories (matching pattern: digits + dash + name)
chapters <- sort(list.dirs(".", recursive = FALSE, full.names = FALSE))
chapters <- chapters[grepl("^[0-9]+-", chapters)]

if (!length(chapters)) {
  cat(
    "No chapter directories found (expected pattern: 01-name/, 02-name/, ...)\n"
  )
  quit(status = 1)
}

cat(sprintf("Testing with format: %s\n", toupper(format)))
cat(sprintf("Found chapters: %s\n", paste(chapters, collapse = ", ")))

test_question <- function(question_file, chapter, format = "moodle") {
  cat(sprintf("\n=== Testing: %s ===\n", basename(question_file)))
  tryCatch(
    {
      render_fn <- if (format == "html") exams2html else exams2moodle
      render_fn(
        file = question_file,
        n = 1,
        name = sprintf(
          "%s_%s",
          chapter,
          tools::file_path_sans_ext(basename(question_file))
        ),
        dir = sprintf("test_output/%s", chapter),
        edir = chapter,
        verbose = FALSE
      )
      cat(sprintf("OK: %s\n", basename(question_file)))
      TRUE
    },
    error = function(e) {
      cat(sprintf("FAIL: %s\n", e$message))
      FALSE
    }
  )
}

all_success <- TRUE
total <- 0L
passed <- 0L

for (chapter in chapters) {
  cat(sprintf("\n\n########## %s ##########\n", chapter))
  question_files <- list.files(chapter, pattern = "\\.Rmd$", full.names = TRUE)
  cat(sprintf("Found %d questions\n", length(question_files)))
  total <- total + length(question_files)
  for (qf in question_files) {
    ok <- test_question(qf, chapter, format)
    if (ok) passed <- passed + 1L else all_success <- FALSE
  }
}

cat("\n\n########## SUMMARY ##########\n")
cat(sprintf(
  "Format: %s | Tested: %d | Passed: %d | Failed: %d\n",
  toupper(format),
  total,
  passed,
  total - passed
))

if (!all_success) quit(status = 1)
