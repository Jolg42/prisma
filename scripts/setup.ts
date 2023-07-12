import execa from 'execa'
import { bold, dim, red, underline } from 'kleur/colors'
import fetch from 'node-fetch'
import path from 'path'

async function main() {
  // this is for when you want to use it locally
  const buildOnly = process.argv[2] === '--build' // can we remove this?

  if (!process.env.RELEASE_TO_LATEST && !process.env.BUILDKITE_TAG) {
    throw new Error(`RELEASE_TO_LATEST & BUILDKITE_TAG must be defined to release to latest.`)
  }

  // TODO: separate into utils shared between publish & setup
  if (buildOnly === false) {
    console.debug(`Installing dependencies`)
    await run('.', `pnpm i`).catch((e) => {
      console.error(e)
    })
  }

  console.debug(`Building packages`)
  // Build CLI
  await run('.', `pnpm -r build`)

  if (buildOnly) {
    return
  }
}

// TODO: fix this
if (!module.parent) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}

// TODO: export this into a utility folder
export async function run(cwd: string, cmd: string, dry = false): Promise<execa.ExecaReturnValue<string> | undefined> {
  const args = [underline('./' + cwd).padEnd(20), bold(cmd)]
  if (dry) {
    args.push(dim('(dry)'))
  }
  console.debug(args.join(' '))
  if (dry) {
    return
  }
  try {
    return await execa.command(cmd, {
      cwd,
      stdio: 'inherit',
    })
  } catch (_e) {
    const e = _e as execa.ExecaError
    throw new Error(bold(red(`Error running ${bold(cmd)} in ${underline(cwd)}:`)) + (e.stack || e.message))
  }
}

/**
 * Runs a command and returns the resulting stdout in a Promise.
 * @param cwd cwd for running the command
 * @param cmd command to run
 */
async function runResult(cwd: string, cmd: string): Promise<string> {
  try {
    const result = await execa.command(cmd, {
      cwd,
      stdio: 'pipe',
      shell: true,
    })
    return result.stdout
  } catch (_e) {
    const e = _e as execa.ExecaError
    throw new Error(red(`Error running ${bold(cmd)} in ${underline(cwd)}:`) + (e.stderr || e.stack || e.message))
  }
}

async function checkoutPatchBranches(patchBranch: string) {
  const repoPath = path.join(__dirname, '../../')
  if (await branchExists(repoPath, patchBranch)) {
    await run(repoPath, `git checkout ${patchBranch}`)
  } else {
    // TODO enable
    // const tag = getTagFromPatchBranch(patchBranch)
    // console.log(
    //   `Patch branch ${patchBranch} is getting checked out from tag ${tag}`,
    // )
    // await run(repoPath, `git checkout -b ${patchBranch} ${tag}`)

    // TODO: For the current 2.1.1 patch we need this, as otherwise our updated publish script wouldn't be part of this
    await run(repoPath, `git checkout -b ${patchBranch}`)
  }
}

async function branchExists(dir: string, branch: string): Promise<boolean> {
  const output = await runResult(dir, `git branch --list ${branch}`)
  const exists = output.trim().length > 0
  if (exists) {
    console.log(`Branch exists: ${exists}`)
  }
  return exists
}
