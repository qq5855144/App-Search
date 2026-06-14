# pyecharts Complete Visualization Guide

## Core Principles

MANDATORY RULES for all pyecharts charts:

1. **CDN Configuration**: ALWAYS set CDN at the beginning to use faster CDN for JavaScript assets
   ```python
   from pyecharts.globals import CurrentConfig
   CurrentConfig.ONLINE_HOST = "https://miaoda-resource-static.s3cdn.medo.dev/pyecharts-assets/"
   ```
2. **Chart Quantity Limit**: Default maximum 4 charts per analysis (unless explicitly requested or insufficient for analysis needs)
3. **Data Type Conversion**: Always convert pandas/numpy data to Python native types using `.tolist()`
4. **Axis Type Specification**: Always specify `type_` for both axes to avoid blank charts
5. **Data Validation**: Check for empty data and null values before rendering
6. **Title Positioning**: Always position title at left-top (`pos_left="2%", pos_top="2%"`) to avoid overlap with legends and data labels
7. **Responsive Layout**: Use `width="100%"` for adaptive width, e.g., `chart = Bar(init_opts=opts.InitOpts(width="100%", height="500px"))`
8. **No Subtitle**: NEVER set subtitle for any chart - always use `subtitle=""` or omit subtitle parameter to avoid clutter and overlap
9. **No Default Toolbox**: Do NOT add toolbox by default - keep charts clean without unnecessary UI elements
10. **Avoid Label/Data Occlusion**: Rotate labels for crowded categories, limit data points, position legends carefully
11. **HTML Output**: Always render to `.html` and print confirmation message

**When creating reports with multiple charts:**
- Use `chart.render_embed()` (or equivalent) to generate chart HTML snippets and embed them directly into the report
- All charts and report content should be assembled into one complete report HTML file
- Do NOT generate separate chart HTML files and reference them via `<iframe>`, relative file paths, or hyperlinks between HTML files
- Result: Generate only one final self-contained report HTML file

## Common Mistakes That Cause Empty Charts

### Mistake 1: Using NumPy Data Types
```python
# WRONG - Will cause blank or broken charts
x_data = df['category'].values  # numpy.ndarray
y_data = df['value'].values     # numpy.int64/numpy.float64

chart.add_xaxis(x_data)  # ERROR
chart.add_yaxis("Series", y_data)  # ERROR
```

```python
# CORRECT - Convert to native Python types
x_data = df['category'].tolist()  # list of strings
y_data = df['value'].astype(float).tolist()  # list of floats

chart.add_xaxis(x_data)  # Works
chart.add_yaxis("Series", y_data)  # Works
```

### Mistake 2: Not Specifying Axis Types
```python
# WRONG - Charts may appear blank
chart.set_global_opts(
    xaxis_opts=opts.AxisOpts(),  # Missing type_
    yaxis_opts=opts.AxisOpts()   # Missing type_
)
```

```python
# CORRECT - Always specify axis types
chart.set_global_opts(
    xaxis_opts=opts.AxisOpts(type_="category"),  # "category", "value", "time", or "log"
    yaxis_opts=opts.AxisOpts(type_="value")
)
```

## Chart Types and When to Use Them

| Chart Type | Use Case | pyecharts Class |
|------------|----------|-----------------|
| Line | Trends over time, continuous data | `Line()` |
| Bar | Category comparison, rankings | `Bar()` |
| Combination | Multiple metrics with different scales | `Bar().overlap(Line())` |
| Pie | Part-of-whole (2-6 categories) | `Pie()` |
| Scatter | Correlation, outliers | `Scatter()` |
| HeatMap | Matrix data, correlation grids | `HeatMap()` |
| Boxplot | Distribution with quartiles | `Boxplot()` |
| Funnel | Conversion funnels | `Funnel()` |
| Gauge | Single KPI value | `Gauge()` |
| Radar | Multi-dimensional comparison | `Radar()` |

## Complete Chart Examples

### 1. Bar Chart (Category Comparison)

```python
from pyecharts.charts import Bar
from pyecharts import options as opts
from pyecharts.globals import CurrentConfig
import pandas as pd

# CRITICAL: Set CDN for faster loading
CurrentConfig.ONLINE_HOST = "https://miaoda-resource-static.s3cdn.medo.dev/pyecharts-assets/"

# Sample data
df = pd.DataFrame({
    'category': ['Product A', 'Product B', 'Product C', 'Product D', 'Product E'],
    'sales': [120, 200, 150, 80, 70],
    'profit': [20, 35, 25, 10, 8]
})

# CRITICAL: Convert to Python lists
categories = df['category'].tolist()
sales = df['sales'].tolist()
profit = df['profit'].tolist()

# Create bar chart
chart = Bar()

chart.add_xaxis(categories)
chart.add_yaxis("Sales", sales)
chart.add_yaxis("Profit", profit)

chart.set_global_opts(
    title_opts=opts.TitleOpts(title="Sales and Profit by Product", pos_left="2%", pos_top="2%"),
    tooltip_opts=opts.TooltipOpts(trigger="axis", axis_pointer_type="shadow"),
    xaxis_opts=opts.AxisOpts(type_="category"),
    yaxis_opts=opts.AxisOpts(type_="value", name="Amount ($)"),
    legend_opts=opts.LegendOpts(pos_top="8%"),
    datazoom_opts=[opts.DataZoomOpts(type_="inside")]
)

chart.render("bar_chart.html")
print("Bar chart saved to bar_chart.html")
```

### 2. Line Chart (Time Series Trend)

```python
from pyecharts.charts import Line
from pyecharts import options as opts
from pyecharts.globals import CurrentConfig
import pandas as pd

# CRITICAL: Set CDN for faster loading
CurrentConfig.ONLINE_HOST = "https://miaoda-resource-static.s3cdn.medo.dev/pyecharts-assets/"

df = pd.DataFrame({
    'date': pd.date_range('2024-01-01', periods=30, freq='D'),
    'value': [100 + i*2 + (i%7)*10 for i in range(30)]
})

# Convert to Python lists (REQUIRED)
dates = df['date'].dt.strftime('%Y-%m-%d').tolist()
values = df['value'].tolist()

chart = Line()
chart.add_xaxis(dates)
chart.add_yaxis("Daily Value", values, is_smooth=True)

chart.set_global_opts(
    title_opts=opts.TitleOpts(title="Daily Trend", pos_left="2%", pos_top="2%"),
    xaxis_opts=opts.AxisOpts(type_="category"),
    yaxis_opts=opts.AxisOpts(type_="value"),
    datazoom_opts=[opts.DataZoomOpts(type_="inside")]
)

chart.render("line_chart.html")
print("Line chart saved to line_chart.html")
```

### 3. Pie Chart (Part-of-Whole)

```python
from pyecharts.charts import Pie
from pyecharts import options as opts
from pyecharts.globals import CurrentConfig
import pandas as pd

# CRITICAL: Set CDN for faster loading
CurrentConfig.ONLINE_HOST = "https://miaoda-resource-static.s3cdn.medo.dev/pyecharts-assets/"

# Sample data
df = pd.DataFrame({
    'category': ['Mobile', 'Desktop', 'Tablet', 'Other'],
    'count': [4500, 3200, 1200, 600]
})

# CRITICAL: Convert to list of tuples
categories = df['category'].tolist()
counts = df['count'].tolist()
data_pair = list(zip(categories, counts))

chart = Pie()

chart.add(
    "",
    data_pair,
    radius=["30%", "75%"],  # Donut style
    rosetype="radius"  # Rose chart for better comparison
)

chart.set_global_opts(
    title_opts=opts.TitleOpts(title="Traffic by Device Type", pos_left="2%", pos_top="2%"),
    legend_opts=opts.LegendOpts(
        orient="vertical",
        pos_left="2%",
        pos_top="12%"
    ),
    tooltip_opts=opts.TooltipOpts(
        trigger="item",
        formatter="{b}: {c} ({d}%)"
    )
)

chart.set_series_opts(
    label_opts=opts.LabelOpts(formatter="{b}: {d}%")
)

chart.render("pie_chart.html")
print("Pie chart saved to pie_chart.html")
```

### 4. Scatter Plot (Correlation Analysis)

```python
from pyecharts.charts import Scatter
from pyecharts import options as opts
from pyecharts.globals import CurrentConfig
import pandas as pd

# CRITICAL: Set CDN for faster loading
CurrentConfig.ONLINE_HOST = "https://miaoda-resource-static.s3cdn.medo.dev/pyecharts-assets/"

df = pd.DataFrame({
    'x': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    'y': [2, 4, 5, 4, 5, 7, 8, 9, 10, 12]
})

x_values = df['x'].tolist()
y_values = df['y'].tolist()

chart = Scatter()
chart.add_xaxis(x_values)
chart.add_yaxis("Data Points", y_values, symbol_size=20)

chart.set_global_opts(
    title_opts=opts.TitleOpts(title="Correlation Analysis", pos_left="2%", pos_top="2%"),
    xaxis_opts=opts.AxisOpts(type_="value", name="X Variable"),
    yaxis_opts=opts.AxisOpts(type_="value", name="Y Variable")
)

chart.render("scatter_chart.html")
print("Scatter chart saved to scatter_chart.html")
```

### 5. Histogram (Distribution)

```python
from pyecharts.charts import Bar
from pyecharts import options as opts
from pyecharts.globals import CurrentConfig
import numpy as np

# CRITICAL: Set CDN for faster loading
CurrentConfig.ONLINE_HOST = "https://miaoda-resource-static.s3cdn.medo.dev/pyecharts-assets/"

data = np.random.normal(100, 15, 1000)
hist, bin_edges = np.histogram(data, bins=30)

bin_labels = [f"{bin_edges[i]:.1f}" for i in range(len(bin_edges)-1)]
counts = hist.tolist()

chart = Bar()
chart.add_xaxis(bin_labels)
chart.add_yaxis("Frequency", counts, category_gap="0%")

chart.set_global_opts(
    title_opts=opts.TitleOpts(title="Distribution Histogram", pos_left="2%", pos_top="2%"),
    xaxis_opts=opts.AxisOpts(type_="category"),
    yaxis_opts=opts.AxisOpts(type_="value", name="Count")
)

chart.render("histogram.html")
print("Histogram saved to histogram.html")
```

### 6. Combination Chart (Bar + Line)

```python
from pyecharts.charts import Bar, Line
from pyecharts import options as opts
from pyecharts.globals import CurrentConfig
import pandas as pd

# CRITICAL: Set CDN for faster loading
CurrentConfig.ONLINE_HOST = "https://miaoda-resource-static.s3cdn.medo.dev/pyecharts-assets/"

# Sample data: sales and growth rate by month
df = pd.DataFrame({
    'month': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    'sales': [120, 150, 180, 160, 200, 220],
    'growth_rate': [0, 25, 20, -11, 25, 10]
})

# Convert to Python lists (REQUIRED)
months = df['month'].tolist()
sales = df['sales'].tolist()
growth_rate = df['growth_rate'].tolist()

# Create bar chart
bar = Bar()
bar.add_xaxis(months)
bar.add_yaxis("Sales", sales, yaxis_index=0, z=1)  # Lower z-level for bars

# Create line chart
line = Line()
line.add_xaxis(months)
line.add_yaxis("Growth Rate (%)", growth_rate, yaxis_index=1, z=3)  # Higher z-level to avoid being blocked by bars

# Combine bar and line
bar.overlap(line)

bar.set_global_opts(
    title_opts=opts.TitleOpts(title="Sales and Growth Rate", pos_left="2%", pos_top="2%"),
    xaxis_opts=opts.AxisOpts(type_="category"),
    yaxis_opts=opts.AxisOpts(
        type_="value",
        name="Sales",
        position="left"
    ),
    legend_opts=opts.LegendOpts(pos_top="8%", pos_left="center")  # Center legend to avoid overlap with right Y-axis
)

# Add second y-axis for growth rate
bar.extend_axis(
    yaxis=opts.AxisOpts(
        type_="value",
        name="Growth Rate (%)",
        position="right"
    )
)

bar.render("combination_chart.html")
print("Combination chart saved to combination_chart.html")
```

## Common Configuration Quick Reference

**ALWAYS set CDN first:**

```python
from pyecharts.globals import CurrentConfig

# CRITICAL: Set this at the very beginning of your script
CurrentConfig.ONLINE_HOST = "https://miaoda-resource-static.s3cdn.medo.dev/pyecharts-assets/"
```

**Basic chart setup with responsive layout:**

```python
from pyecharts.charts import Bar
from pyecharts import options as opts

# Responsive layout: use width="100%" for adaptive width
chart = Bar(init_opts=opts.InitOpts(width="100%", height="500px"))
```

**Common configurations:**

```python
# Rotate labels for long text
xaxis_opts=opts.AxisOpts(axislabel_opts=opts.LabelOpts(rotate=45, interval=0))

# Custom tooltip format
tooltip_opts=opts.TooltipOpts(trigger="axis", formatter="{b}: ${c:,.2f}")

# DataZoom for large datasets
datazoom_opts=[
    opts.DataZoomOpts(range_start=0, range_end=100),
    opts.DataZoomOpts(type_="inside")
]

# Z-level for combination charts (prevent bars from blocking lines)
bar.add_yaxis("Sales", data, z=1)  # Lower z-level for bars
line.add_yaxis("Trend", data, z=3)  # Higher z-level for lines
```

## Responsive Layout

**All charts must use responsive width for adaptive display:**

### 1. Chart Initialization
Use `width="100%"` for responsive width, e.g.:
```python
chart = Bar(init_opts=opts.InitOpts(width="100%", height="500px"))
```

### 2. Single Chart HTML
Use `render()` to generate HTML - resize listener code is automatically included:
```python
chart.render("chart.html")
```

### 3. Multi-Chart Reports
When using `render_embed()` to embed charts in reports, you must generate unified resize listener code before `</body>` tag:

```javascript
<script>
(function() {
  var charts = [chart_id1, chart_id2, chart_id3];  // Replace with actual chart variable names
  var timer;
  window.addEventListener("resize", function() {
    clearTimeout(timer);
    timer = setTimeout(function() {
      charts.forEach(function(c) { c.resize(); });
    }, 100);
  });
})();
</script>
```

**Note:** Replace `chart_id1, chart_id2, chart_id3` with actual chart variable names generated by pyecharts (e.g., `chart_7b7c54ccc41e436b989d8cfe6ce30ef7`).

## Troubleshooting Checklist

Before asking for help, verify:

- [ ] CDN configured at the beginning (`CurrentConfig.ONLINE_HOST`)
- [ ] All data converted to Python native types (`.tolist()`)
- [ ] Both x and y axes have `type_` specified
- [ ] No NaN or None values in data (use `.fillna()` or filter)
- [ ] Data is not empty (checked before rendering)
- [ ] HTML file size > 0 (not corrupted)
- [ ] Used correct data structure for chart type
- [ ] All required imports included

## Quick Reference: Data Conversion

```python
# DataFrame to list
df['column'].tolist()

# Series to list
series.tolist()

# NumPy array to list
np_array.tolist()

# Handle NaN values
df['column'].fillna(0).tolist()

# Date conversion
df['date'].dt.strftime('%Y-%m-%d').tolist()

# Round floats
df['value'].round(2).tolist()

# Convert to int
df['count'].astype(int).tolist()

# List comprehension alternative
[float(x) for x in df['column']]
```

## Final Checklist for Every Chart

- Set CDN configuration at the beginning (`CurrentConfig.ONLINE_HOST`)
- Converted all data to native Python types
- Validated data (not empty, no all-null columns)
- Specified `type_` for all axes
- Positioned title at left-top (`pos_left="2%", pos_top="2%"`)
- Used responsive layout with `width="100%"`
- Added descriptive title
- Enabled tooltip for interactivity
- Handled missing data
- Tested rotation for long labels
- Added legend if multiple series (position below title to avoid overlap)
- Rendered to HTML file
- For multi-chart reports, included resize listener code
- Printed confirmation message

**Remember: The #1 cause of blank charts is forgetting to convert NumPy/pandas data to Python lists!**

---

## Advanced Troubleshooting Guide

### Avoiding Element Overlap Issues

**Problem: Title overlaps with legends or data labels**

**Solution:** Always position title at left-top
```python
title_opts=opts.TitleOpts(title="Chart Title", pos_left="2%", pos_top="2%")
legend_opts=opts.LegendOpts(pos_top="8%")  # Position legend below title
```

**Problem: Legend overlaps with Y-axis labels in dual-axis charts**

**Solution:** Center the legend or position at bottom for combination charts with two Y-axes
```python
# For dual Y-axis charts (e.g., Bar + Line)
legend_opts=opts.LegendOpts(pos_top="8%", pos_left="center")  # Center to avoid both Y-axes

# Or position at bottom
legend_opts=opts.LegendOpts(pos_bottom="5%")
```

**Problem: Bar chart blocks line chart data points in combination charts**

**Solution:** Set higher z-level for line chart to display above bars
```python
# Create bar chart with lower z-level
bar.add_yaxis("Sales", sales, z=1)

# Create line chart with higher z-level
line.add_yaxis("Growth Rate", growth_rate, z=3)  # Line will display above bars
```

**Problem: Data labels overlap with each other**

**Solutions:**
```python
# Option 1: Hide some labels for dense data
label_opts=opts.LabelOpts(is_show=False)

# Option 2: Rotate labels for line/bar charts
label_opts=opts.LabelOpts(rotate=45)

# Option 3: Position labels strategically
label_opts=opts.LabelOpts(position="top")  # or "inside", "bottom", etc.

# Option 4: Show labels only on hover
label_opts=opts.LabelOpts(is_show=False)
tooltip_opts=opts.TooltipOpts(trigger="axis")  # Labels shown in tooltip instead
```

**Best Practice Summary:**
- **Title**: Left-top (`pos_left="2%", pos_top="2%"`)
- **Legend**: Below title (`pos_top="8%"`) for single Y-axis; center (`pos_left="center"`) or bottom (`pos_bottom="5%"`) for dual Y-axis charts
- **Combination charts**: Set bar `z=1`, line `z=3` to prevent bars from blocking line data points
- **Data labels**: Use tooltips for dense data instead of always-visible labels

### Empty Chart Prevention

**Always validate data before rendering:**

```python
# Check for empty data and null values
if df.empty or df[value_col].isnull().all():
    print(f"Error: Insufficient data in '{value_col}'")
    return

# Clean data
df_clean = df.dropna(subset=[value_col])
if len(df_clean) == 0:
    print("Error: No valid data after cleaning")
    return

# Convert to lists (REQUIRED)
x_data = df_clean['category'].tolist()
y_data = df_clean[value_col].tolist()
```

**Common causes:** Empty dataframe • All-null values • Missing axis types • NumPy data types

### Label Overlap Solutions

**X-axis labels crowded:**
```python
# Rotate labels
xaxis_opts=opts.AxisOpts(axislabel_opts=opts.LabelOpts(rotate=45, interval=0))

# Or use horizontal bar chart
chart.reversal_axis()

# Or limit categories to top 20
if len(df) > 20:
    df = df.nlargest(20, value_col)
```

**Legend overlapping:**
```python
# Scrollable legend
legend_opts=opts.LegendOpts(type_="scroll", pos_bottom="0%")

# Or position outside
legend_opts=opts.LegendOpts(orient="vertical", pos_right="0%", pos_top="10%")
```

**Pie chart labels:**
```python
# Limit to 2-6 categories, combine rest as "Others"
if len(df) > 6:
    top_n = df.nlargest(5, value_col)
    others_sum = df[~df['category'].isin(top_n['category'])][value_col].sum()
    others = pd.DataFrame([{'category': 'Others', value_col: others_sum}])
    df = pd.concat([top_n, others])
```

### Large Dataset Optimization

**Symptoms:** Slow rendering (>5s) • Browser lag • High memory usage

**Solutions:**

```python
# 1. Aggregate data (for datasets >1000 rows)
if len(df) > 1000:
    df = df.groupby('category')[value_col].mean().reset_index()

# 2. Enable dataZoom for navigation
datazoom_opts=[
    opts.DataZoomOpts(type_="slider", range_start=0, range_end=100),
    opts.DataZoomOpts(type_="inside")
]

# 3. Limit display points
if len(df) > 1000:
    df = df.nlargest(1000, value_col)

# 4. Sample scatter plots (if >5000 points)
if len(df) > 5000:
    df = df.sample(n=5000, random_state=42)
```

### Title and Layout Best Practices

**Single chart (DEFAULT):**
```python
# Always position title at left-top to avoid overlap with legends and data labels
title_opts=opts.TitleOpts(title="Chart Title", pos_left="2%", pos_top="2%")
```

**Multi-chart layout (Grid/Page):**
```python
# Use percentage positioning to avoid overlap
chart1.set_global_opts(title_opts=opts.TitleOpts(title="Sales", pos_left="22%", pos_top="2%"))
chart2.set_global_opts(title_opts=opts.TitleOpts(title="Users", pos_left="72%", pos_top="2%"))
```

**Standard positioning to avoid overlaps:**
```python
# Title at left-top
title_opts=opts.TitleOpts(title="Chart Title", pos_left="2%", pos_top="2%")

# Legend below title (single Y-axis charts)
legend_opts=opts.LegendOpts(pos_top="8%")

# Legend centered (dual Y-axis charts to avoid right axis labels)
legend_opts=opts.LegendOpts(pos_top="8%", pos_left="center")
```

**Critical Rules:**
- **Always** position title at `pos_left="2%", pos_top="2%"` to avoid overlap
- **NEVER set subtitle** - always use `subtitle=""` or omit subtitle parameter for all charts
- **Default to NO toolbox** - do not add toolbox unless explicitly needed
- Position legends below title (`pos_top="8%"`) for single Y-axis charts
- **For dual Y-axis charts**: Center legend (`pos_left="center"`) or position at bottom to avoid overlap with right Y-axis labels
