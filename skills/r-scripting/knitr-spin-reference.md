# Teaching Demos with knitr::spin

For literate R scripts that render directly to PDF/HTML via `knitr::spin()`:

## Basic Syntax

```r
#' # Document Title
#'
#' Prose text uses `#'` prefix. Supports **markdown** and $\LaTeX$ math.

library(tidyverse)  # Regular code has no prefix

#' ## Section Header
#'
#' Explanatory text before code...

result <- compute_something()
result  # Output will appear in rendered document

#' Interpretation of results above...
```

## Chunk Options

```r
#+ chunk_name, fig.width = 10, fig.height = 6
ggplot(data, aes(x, y)) + geom_point()

#+ include = FALSE
# Hidden setup code

#- message = FALSE
library(tidyverse)  # Suppress messages
```

## Pedagogical Patterns

**Questions for students:**
```r
#' **?**:
#' > *Why does this model produce biased estimates?*
```

**Important notes/warnings:**
```r
#' **!**:
#' > *Try re-running with smaller sample sizes...*
```

**Mathematical context:**
```r
#' The error covariance is $$\Sigma_{i,jk} = \tau^2 \rho^{|t_j - t_k|}$$
```

**Block quotes (from literature):**
```r
#' From Author (Year):
#'
#' > Quoted text here spanning
#' > multiple lines...
```

**Implications/conclusions:**
```r
#' $\implies$
#'
#' - First conclusion
#' - Second conclusion
```

## Demo Structure

```r
#' # Demo Title
#'
#' Brief introduction to the topic.

#+ setup, include = FALSE
library(tidyverse)
set.seed(42)
options(digits = 3)

#' ## Setup & Data
#'
#' Description of data generation/loading...

data <- generate_data()

#' ## Analysis
#'
#' What we're doing and why...

fit <- lm(y ~ x, data)
summary(fit)

#' The coefficient estimate of `r coef(fit)[2]` suggests...
#'
#' **?**:
#' > *What happens if we violate assumption X?*

#' ## Visualization

#+ main_plot, fig.width = 8, fig.height = 5
ggplot(data, aes(x, y)) + geom_point() + geom_smooth()

#' ## Conclusions
#'
#' Key takeaways...
```

## Rendering

```r
# To PDF (requires LaTeX)
knitr::spin("analysis.R", knit = FALSE)
rmarkdown::render("analysis.Rmd", output_format = "pdf_document")

# Or directly
rmarkdown::render("analysis.R", output_format = "pdf_document")
```

## Best Practices

1. **Flow**: Interleave code and explanation—don't dump code then explain
2. **Visibility**: Show intermediate results; let output speak
3. **Questions**: Use `**?**:` blocks to prompt student thinking
4. **Math**: Use LaTeX for formulas: `$inline$` or `$$display$$`
5. **Comparisons**: Show correct vs incorrect approaches side-by-side
6. **Reproducibility**: Set `set.seed()` and `options(digits = N)` upfront
7. **Progressive complexity**: Start simple, add complications incrementally
8. **Figures**: Use chunk options for sizing; let plots render inline
