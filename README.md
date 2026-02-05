# Tabulazer
A Chrome Extension to filter, sort, page and style any existing HTML table using the Tabulator JS library (v6.3.0).

## Introduction
Do you work with websites featuring a lot of HTML tables? Would you like to filter, sort and/or page them? If so, then this lightweight extension might be useful.

You can use it to transform any standard table into a fully-featured interactive table with the following features:

* Real-time column sorting (and reverse sorting)
* Real-time column filtering (including a quick full-text search)
* Dynamic paging (useful for very long tables) with configurable page size
* Resizable columns (using mouse handlers)
* Optional width enlarge to 100% (to increase readability)
* Side Panel UI to quickly:
  * pick a table from the page (overlay picker)
  * list all detected tables and toggle them on/off
  * jump to/select a specific table
* Visual preferences such as compact mode, zebra rows and font size scaling
* Optional column chooser (show/hide columns)
* Optional layout persistence (remember table layout)
* Copy/export features:
  * copy table data to clipboard
  * download table data as CSV/XLSX/XML
  * export either the current view (respecting filters/sort when available) or all rows

... and more!

Highly recommended if you're dealing with big tables and need to quickly extract relevant data from them.

The transformation is done using <a href="http://tabulator.info/" target="_blank">Tabulator</a>, a great table management JS library made by <a href="https://github.com/olifolkerd">Oli Folkerd</a> which I'm extensively using in all my web-based projects.

## External Packages
Here's a list of all the open-source, third-party packages that have been used within the extension (all credit due to their respective authors):
* <a href="https://github.com/olifolkerd/tabulator" target="_blank">Tabulator</a> (v6.3.0), by <a href="https://github.com/olifolkerd/" target="_blank">Oli Folkerd</a> (<a href="https://github.com/olifolkerd/tabulator/blob/master/LICENSE" target="_blank">MIT</a> license)
* <a href="https://github.com/twbs/bootstrap/" target="_blank">Bootstrap</a>, by <a href="https://getbootstrap.com/docs/4.3/about/team/" target="_blank">the Bootstrap team</a> (<a href="https://github.com/twbs/bootstrap/blob/master/LICENSE" target="_blank">MIT</a> license)
* <a href="https://github.com/jquery/jquery" target="_blank">jQuery</a>, by <a href="https://jquery.org/team/" target="_blank">the jQuery Foundation</a> (<a href="https://github.com/jquery/jquery/blob/master/LICENSE.txt" target="_blank">MIT</a> license)
* <a href="https://github.com/SheetJS/sheetjs" target="_blank">SheetJS</a>, for XLSX export (<a href="https://github.com/SheetJS/sheetjs/blob/master/LICENSE" target="_blank">Apache-2.0</a> license)

## Useful Resources
* <a href="https://www.ryadel.com/en/tabulazer-chrome-extension-filter-sort-html-table-tables/" target="_blank">Tabulazer Official Page</a>
* <a href="https://github.com/Darkseal/Tabulazer" target="_blank">Tabulazer on GitHub</a>
* <a href="https://github.com/olifolkerd/tabulator" target="_blank">Tabulator on GitHub</a>
