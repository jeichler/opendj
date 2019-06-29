# Git Usage Guidelines
As we are currently only few contributors, we follow more allong the collective code ownership principle: every body works on the master branch and pull/pushes frequently.  
Of course you can branch/fork at any time and submit a pull request  when done.  

# Labels
Each version get an annotated Tag in the semantic versioning format
<major>.<minor>.<update>
Create a tag  using 
```
git tag -a 0.3.1 -m "During Sprint 03 - After IPO"
git push origin 0.3.1
```

For each deployment environment / stage, there is lightweight tag marking the version that is deployed to that environment in the format `env-name`, e.g. `env-dev`,  `env-demo` These tags move on each deployment.
PLease note that the "dev" env might be build from head of master branch for easy of development.


# Github:
For each sprint, we use a [github project](https://github.com/opendj/opendj/projects).
Please make sure you create a card / issue for each item you are working on and move it to the corresponding swimlane. Visibility of what you are doing is important to avoid double work!
