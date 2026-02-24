import { describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildCommentTree,
  deriveInitialCommentsLoadState,
  loadEnrichedCommentsFlat,
  type EnrichedThreadComment,
} from "@/lib/comments/thread-loader"

type QueryResult<T> = { data: T; error: { message: string } | null }

const createBuilder = <T>(result: QueryResult<T>) => {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    maybeSingle: () => builder,
    then: (
      onFulfilled?: (value: QueryResult<T>) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  return builder
}

describe("comments thread loader", () => {
  it("builds sorted tree with solution first then chronological order", () => {
    const items: EnrichedThreadComment[] = [
      {
        id: "c3",
        content: "third",
        created_at: "2026-01-03T10:00:00.000Z",
        user_id: "u1",
        parent_id: null,
        is_solution: false,
      },
      {
        id: "c1",
        content: "solution",
        created_at: "2026-01-01T10:00:00.000Z",
        user_id: "u1",
        parent_id: null,
        is_solution: true,
      },
      {
        id: "r1",
        content: "reply on c3",
        created_at: "2026-01-04T10:00:00.000Z",
        user_id: "u2",
        parent_id: "c3",
        is_solution: false,
      },
      {
        id: "c2",
        content: "second",
        created_at: "2026-01-02T10:00:00.000Z",
        user_id: "u1",
        parent_id: null,
        is_solution: false,
      },
    ]

    const tree = buildCommentTree(items)
    expect(tree.map((c) => c.id)).toEqual(["c1", "c2", "c3"])
    expect(tree[2]?.replies?.map((c) => c.id)).toEqual(["r1"])
  })

  it("enriches comments with votes, actor vote and liked-by-author", async () => {
    const comments = [
      {
        id: "c1",
        content: "hello",
        created_at: "2026-01-01T10:00:00.000Z",
        user_id: "u1",
        parent_id: null,
        is_solution: false,
        users: null,
      },
    ]
    const allVotes = [
      { comment_id: "c1", type: "Upvote" },
      { comment_id: "c1", type: "Upvote" },
      { comment_id: "c1", type: "Downvote" },
    ]
    const actorVotes = [
      { comment_id: "c1", type: "Downvote", user_id: "viewer-1" },
      { comment_id: "c1", type: "Upvote", user_id: "author-1" },
    ]

    let commentVotesQueries = 0
    const supabase = {
      from: (table: string) => {
        if (table === "propositions") {
          return createBuilder({
            data: { author_id: "author-1" },
            error: null,
          })
        }
        if (table === "comments") {
          return createBuilder({ data: comments, error: null })
        }
        if (table === "comment_votes") {
          commentVotesQueries += 1
          return createBuilder({
            data: commentVotesQueries === 1 ? allVotes : actorVotes,
            error: null,
          })
        }
        throw new Error(`Unexpected table: ${table}`)
      },
    } as unknown as SupabaseClient

    const loaded = await loadEnrichedCommentsFlat({
      supabase,
      propositionId: "p1",
      currentUserId: "viewer-1",
      propositionAuthorId: null,
    })

    expect(loaded.propositionAuthorId).toBe("author-1")
    expect(loaded.comments).toHaveLength(1)
    expect(loaded.comments[0]?.votesCount).toBe(1)
    expect(loaded.comments[0]?.currentUserVote).toBe("Downvote")
    expect(loaded.comments[0]?.likedByAuthor).toBe(true)
  })

  it("does not fetch proposition author when already provided", async () => {
    const supabase = {
      from: (table: string) => {
        if (table === "propositions") {
          throw new Error("Propositions query should not run")
        }
        if (table === "comments") {
          return createBuilder({ data: [], error: null })
        }
        if (table === "comment_votes") {
          return createBuilder({ data: [], error: null })
        }
        throw new Error(`Unexpected table: ${table}`)
      },
    } as unknown as SupabaseClient

    const loaded = await loadEnrichedCommentsFlat({
      supabase,
      propositionId: "p1",
      currentUserId: "viewer-1",
      propositionAuthorId: "author-42",
    })

    expect(loaded.propositionAuthorId).toBe("author-42")
    expect(loaded.comments).toEqual([])
  })

  it("derives loaded state when SSR comments are present", () => {
    const state = deriveInitialCommentsLoadState([
      {
        id: "c1",
        content: "hello",
        created_at: "2026-01-01T10:00:00.000Z",
        user_id: "u1",
        parent_id: null,
      },
    ])
    expect(state).toBe("loaded")
    expect(deriveInitialCommentsLoadState([])).toBe("empty")
  })
})
