# GitHub Collaboration Instructions

## **DO NOT PUSH TO `main` BRANCH**

The `main` branch is the stable branch of the project. **No team member should directly push code to `main`.**

All development must be done through your personal branch and feature sub-branches.

For the project structure, module responsibilities, and implementation details, refer to:

**`IMPLEMENTATION_GUIDE.md`**

---

## General Instructions

### 1. Create Your Personal Branch

When you first clone the repository, create a branch using your name:

```bash
git switch -c <your-name>
```

For example:

```bash
git switch -c aynansh
```

Your personal branch will act as the base branch for all your work.

---

### 2. Create a Feature Sub-Branch

For every new feature/task, create a separate sub-branch from your personal branch.

First, switch to your personal branch:

```bash
git switch <your-name>
```

Then create a feature branch:

```bash
git switch -c <feature-branch>
```

For example:

```bash
git switch aynansh
git switch -c login-page
```

Your workflow should therefore look like:

```text
main
 │
 ├── aynansh
 │    ├── login-page
 │    ├── dashboard
 │    └── api-integration
 │
 ├── member-2
 │    ├── backend-auth
 │    └── user-api
 │
 └── member-3
      ├── ml-model
      └── prediction-api
```

---

### 3. Work Only on Your Feature Branch

Once you create your feature branch:

```bash
git switch <feature-branch>
```

Make your changes and test them locally.

Do not make changes directly on `main` or another team member's branch.

---

### 4. Commit Your Changes

Check your changes:

```bash
git status
```

Add the required files:

```bash
git add .
```

Commit with a meaningful message:

```bash
git commit -m "Add login functionality"
```

Good commit messages describe what was actually changed.

Examples:

```text
Add login page
Add user authentication API
Fix dashboard loading issue
Integrate prediction API
Update database schema
```

Avoid vague messages such as:

```text
update
changes
done
final
test
```

---

### 5. Push Your Feature Branch

Push your feature branch to GitHub:

```bash
git push -u origin <feature-branch>
```

Example:

```bash
git push -u origin login-page
```

Your code will now be available on GitHub.

---

## 6. Create a Pull Request

Once your feature is complete and tested, create a Pull Request on GitHub.

The Pull Request should eventually merge your work into:

```text
main
```

For example:

```text
login-page → main
```

Before creating the PR, make sure:

* The feature works correctly.
* Your code has been tested.
* No unnecessary files are included.
* No `.env` files or secrets are committed.
* Your changes are limited to your assigned task.
* The project still builds/runs correctly.

---

## 7. Code Review

The project leader will review the Pull Request.

The reviewer may:

* Approve the Pull Request.
* Request changes.
* Comment on specific code.
* Ask for clarification.

If changes are requested, **continue working on the same feature branch**.

```bash
git add .
git commit -m "Address review comments"
git push
```

The existing Pull Request will automatically update.

---

## 8. Merging

Only merge your Pull Request after it has been reviewed and approved.

The final flow is:

```text
Your Feature Branch
        │
        ↓
   Pull Request
        │
        ↓
   Code Review
        │
        ↓
     Approved
        │
        ↓
      main
```

Do not bypass the Pull Request process.

---

## 9. Keeping Your Personal Branch Updated

After features from other team members are merged into `main`, update your personal branch.

First:

```bash
git switch main
git pull origin main
```

Then switch to your personal branch:

```bash
git switch <your-name>
```

Update it with the latest `main`:

```bash
git merge main
```

Then create your next feature branch:

```bash
git switch -c <new-feature>
```

This keeps your work based on the latest version of the project.

---

## 10. Recommended Workflow

For every new task, follow:

```text
main
 ↓
Update main
 ↓
Your personal branch
 ↓
Create feature branch
 ↓
Implement feature
 ↓
Test
 ↓
Commit
 ↓
Push feature branch
 ↓
Create Pull Request
 ↓
Code Review
 ↓
Make changes if requested
 ↓
Approval
 ↓
Merge into main
```

---

## 11. Important Rules

### **Rule 1 — Never push directly to `main`**

```bash
git push origin main
```

**DO NOT DO THIS.**

---

### **Rule 2 — One feature = One feature branch**

Do not put multiple unrelated features into one branch.

Prefer:

```text
login-page
dashboard
payment-api
```

instead of:

```text
everything
```

---

### **Rule 3 — Do not work directly on your personal branch**

Your personal branch should mainly act as the base for your feature branches.

Prefer:

```text
your-name
    ↓
feature-1
feature-2
feature-3
```

rather than making all changes directly on:

```text
your-name
```

---

### **Rule 4 — Do not modify another person's work without communication**

If your feature requires changes to another person's module, coordinate with them first.

---

### **Rule 5 — Do not commit secrets**

Never push:

```text
.env
API keys
Database passwords
JWT secrets
Access tokens
Private keys
```

Use `.env.example` for documenting required environment variables.

---

### **Rule 6 — Keep commits meaningful**

Each commit should represent a logical change.

For example:

```bash
git commit -m "Add user registration API"
git commit -m "Add registration form"
git commit -m "Connect registration form to API"
```

is preferable to one huge:

```bash
git commit -m "project changes"
```

---

## 12. Implementation Guide

For information regarding:

* Project folder structure
* Module ownership
* Responsibilities of each member
* Technologies being used
* APIs/interfaces
* Integration requirements
* Development-specific instructions

refer to:

**`IMPLEMENTATION_GUIDE.md`**

All team members should read the implementation guide before starting development.

---

# Final Workflow

```text
                main
                  │
       ┌──────────┼──────────┐
       ↓          ↓          ↓
    Member 1   Member 2   Member 3
       │          │          │
    own branch own branch own branch
       │          │          │
       ↓          ↓          ↓
   feature-A   feature-B   feature-C
       │          │          │
       └──────────┼──────────┘
                  ↓
             Pull Request
                  ↓
              Code Review
                  ↓
               Approved
                  ↓
                 main
```

### **Branch → Develop → Commit → Push → Pull Request → Review → Merge**

**Following this workflow is mandatory for all contributors.**
