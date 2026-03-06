CHAPTERS := $(patsubst %/,%,$(dir $(wildcard [0-9]*-*/)))

.PHONY: all FORCE $(CHAPTERS:%=%-quiz)

all:
	@echo "Targets: make <chapter>-quiz | <chapter>-quiz.xml | <chapter>-quiz.html (e.g. make 04-lgs-quiz)"

define RENDER_RULES
$(1)-quiz: $(1)-quiz.xml $(1)-quiz.html
	@echo "✓ Rendered $(1) to $(1)/$(1)-quiz.xml and $(1)/$(1)-quiz.html"

$(1)-quiz.xml: FORCE
	@echo "Rendering $(1) to Moodle XML..."
	@Rscript -e "chapter <- '$(1)'; name <- paste0(basename(chapter), '-quiz'); library(exams); setwd(chapter); qs <- list.files(pattern='\\\\.Rmd', full.names=TRUE); exams2moodle(qs, n = 1, name = name, dir = '.', edir = '.', verbose = FALSE); files <- list.files(pattern = paste0('^', name, '.*\\\\.xml'), full.names = TRUE); files <- sort(files); target <- paste0(name, '.xml'); if (!length(files)) stop('No XML generated for ', chapter); if (!file.exists(target) && files[[1]] != target) file.rename(files[[1]], target); message('Wrote ', file.path(chapter, target))"

$(1)-quiz.html: FORCE
	@echo "Rendering $(1) to HTML..."
	@Rscript -e "chapter <- '$(1)'; name <- paste0(basename(chapter), '-quiz'); library(exams); setwd(chapter); qs <- list.files(pattern='\\\\.Rmd', full.names=TRUE); exams2html(qs, n = 1, name = name, dir = '.', edir = '.', verbose = FALSE); files <- list.files(pattern = paste0('^', name, '.*\\\\.html'), full.names = TRUE); files <- sort(files); target <- paste0(name, '.html'); if (!length(files)) stop('No HTML generated for ', chapter); if (!file.exists(target) && files[[1]] != target) file.rename(files[[1]], target); message('Wrote ', file.path(chapter, target))"

endef

$(foreach c,$(CHAPTERS),$(eval $(call RENDER_RULES,$(c))))
