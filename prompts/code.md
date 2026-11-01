{{> _rules}}

# Review: code (project {{project}})

Review the PRAI source in this repository (src/, cli/) as a senior engineer. Focus: {{focus}}
Look for: wrong timing math (frames vs beats, rounding), hooks misuse, crashes on edge cases (empty arrays, equal frames,
missing assets), inputs that pass validation but break rendering, security of anything that runs commands or loads files,
and docs that promise behaviour the code does not have.
Output: up to 10 findings (file:line · problem · failing input · fix), most severe first. Say what you checked and could not check.
