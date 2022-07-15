import { Injectable } from '@nestjs/common'

@Injectable()
export class GraphqlQueryFactoryService {
  public createBlobQuery(project: string, ref: string, path: string): string {
    return `
      query Blobs {
        project(fullPath: "${project}") {
          name
          repository {
            tree(ref: "${ref}", path: "${path}") {
              blobs {
                nodes {
                  path
                }
              }
            }
          }
        }
      }
    `
  }

  public createBlobContentQuery(
    project: string,
    ref: string,
    filePaths: string[],
  ): string {
    const paths = filePaths.map((path) => `"${path}"`).join(',')
    return `
      query Content {
        project(fullPath: "${project}") {
          name
          repository {
            blobs (ref:"${ref}", paths:[${paths}]) {
              edges {
                node {
                  path
                  rawBlob
                }
              }
            }
          }
        }
      }
    `
  }

  public createCommitMutation(): string {
    return `
      mutation CommitCreate($actions:[CommitAction!]!, $branch:String!, $message:String!, $projectPath:ID!) {
        commitCreate(input: {
          actions:$actions,
          branch:$branch, 
          projectPath:$projectPath,
          message:$message,
          }) {
          commit {
            sha
          }
          errors
        }
      }
    `
  }

  public createMergeRequestMutation(): string {
    return `
      mutation MergeRequestCreate($labels:[String!]!, $sourceBranch:String!, $targetBranch:String!, $title:String!, $projectPath:ID!) {
        mergeRequestCreate(input: {
          labels:$labels,
          sourceBranch:$sourceBranch, 
          targetBranch:$targetBranch, 
          projectPath:$projectPath,
          title:$title,
          }) {
          mergeRequest {
            iid
          }
          errors
        }
      }
    `
  }

  public createMergeRequestSetAssigneesMutation(): string {
    return `
      mutation MergeRequestSetAssignees($assigneeUsernames:[String!]!, $iid:String!, $projectPath:ID!) {
        mergeRequestSetAssignees(input: {
          projectPath:$projectPath,
          iid:$iid,
          assigneeUsernames:$assigneeUsernames
          }) {
          mergeRequest {
            iid
          }
          errors
        }
      }
    `
  }

  public createLatestCommitQuery(project: string, ref: string): string {
    return `query Content {
        project(fullPath: "${project}") {
          name
          repository {
            tree(ref:"${ref}") {
              lastCommit {
                sha
              }
            }
          }
        }
      }`
  }
}
