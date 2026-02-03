"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { getSupabaseClient } from "@/utils/supabase/client"

type Props = {
  propositionId: string
  propositionAuthorId: string | null
  propositionPageId: string | null
  pageOwnerId: string | null
  initialVotes: number
  initialStatus: string
}

type CommentItem = {
  id: string
  content: string
  created_at: string
  user_id: string
  is_solution?: boolean | null
  users?:
    | { username: string | null; email: string | null }
    | { username: string | null; email: string | null }[]
    | null
}

type VolunteerItem = {
  user_id: string
  skills_offered: string | null
  status: string | null
  users?:
    | { username: string | null; email: string | null }
    | { username: string | null; email: string | null }[]
    | null
}

export default function PropositionDetailClient({
  propositionId,
  propositionAuthorId,
  propositionPageId,
  pageOwnerId,
  initialVotes,
  initialStatus,
}: Props) {
  const router = useRouter()
  const [votes, setVotes] = useState(initialVotes)
  const [status, setStatus] = useState(initialStatus)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentVote, setCurrentVote] = useState<"Upvote" | "Downvote" | null>(
    null
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [comments, setComments] = useState<CommentItem[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentsError, setCommentsError] = useState<string | null>(null)
  const [commentValue, setCommentValue] = useState("")
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [volunteers, setVolunteers] = useState<VolunteerItem[]>([])
  const [volunteersLoading, setVolunteersLoading] = useState(false)
  const [volunteersError, setVolunteersError] = useState<string | null>(null)
  const [volunteerSkills, setVolunteerSkills] = useState("")
  const [volunteerSubmitting, setVolunteerSubmitting] = useState(false)
  const [ownerNotifyDaily, setOwnerNotifyDaily] = useState(false)
  const [ownerVoteThreshold, setOwnerVoteThreshold] = useState<number | null>(
    null
  )

  const getUserMeta = (
    users:
      | { username: string | null; email: string | null }
      | { username: string | null; email: string | null }[]
      | null
      | undefined
  ) => (Array.isArray(users) ? users[0] : users)

  const isOwner =
    Boolean(currentUserId) && Boolean(pageOwnerId) && currentUserId === pageOwnerId
  const isAuthor =
    Boolean(currentUserId) &&
    Boolean(propositionAuthorId) &&
    currentUserId === propositionAuthorId

  const refreshVotes = async () => {
    const supabase = getSupabaseClient()
    if (!supabase) return
    const { data: voteRows, error: votesError } = await supabase
      .from("votes")
      .select("type")
      .eq("proposition_id", propositionId)

    if (!votesError && voteRows) {
      const computed = voteRows.reduce((sum, row) => {
        if (row.type === "Upvote") return sum + 1
        if (row.type === "Downvote") return sum - 1
        return sum
      }, 0)
      setVotes(computed)
      return computed
    }

    const { data } = await supabase
      .from("propositions")
      .select("votes_count")
      .eq("id", propositionId)
      .single()
    if (data) {
      const computed = data.votes_count ?? 0
      setVotes(computed)
      return computed
    }
  }

  useEffect(() => {
    const fetchCurrentVote = async () => {
      const supabase = getSupabaseClient()
      if (!supabase) return
      const { data: session } = await supabase.auth.getUser()
      const userId = session.user?.id ?? null
      setCurrentUserId(userId)
      if (!userId) return

      const { data } = await supabase
        .from("votes")
        .select("type")
        .eq("proposition_id", propositionId)
        .eq("user_id", userId)
        .maybeSingle()
      if (data?.type) {
        setCurrentVote(data.type)
      }
    }

    fetchCurrentVote()
  }, [propositionId])

  const fetchComments = async () => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setCommentsError("Supabase non configuré.")
      return
    }
    setCommentsLoading(true)
    setCommentsError(null)
    const { data, error: commentsError } = await supabase
      .from("comments")
      .select("id, content, created_at, user_id, is_solution, users(username, email)")
      .eq("proposition_id", propositionId)
      .order("is_solution", { ascending: false })
      .order("created_at", { ascending: false })
    if (commentsError) {
      setCommentsError(commentsError.message)
      setComments([])
    } else {
      setComments(data ?? [])
    }
    setCommentsLoading(false)
  }

  useEffect(() => {
    fetchComments()
  }, [propositionId])

  const fetchVolunteers = async () => {
    if (!propositionPageId) {
      const supabase = getSupabaseClient()
      if (!supabase) {
        setVolunteersError("Supabase non configuré.")
        return
      }
      setVolunteersLoading(true)
      setVolunteersError(null)
      const { data, error: volunteersError } = await supabase
        .from("volunteers")
        .select("user_id, skills_offered, status, users(username, email)")
        .eq("proposition_id", propositionId)
        .order("created_at", { ascending: false })
      if (volunteersError) {
        setVolunteersError(volunteersError.message)
        setVolunteers([])
      } else {
        setVolunteers(data ?? [])
      }
      setVolunteersLoading(false)
    }
  }

  useEffect(() => {
    fetchVolunteers()
  }, [propositionId, propositionPageId])

  useEffect(() => {
    const fetchOwnerSettings = async () => {
      if (!propositionPageId) return
      const supabase = getSupabaseClient()
      if (!supabase) return
      const { data } = await supabase
        .from("pages")
        .select("owner_notify_daily, owner_vote_threshold")
        .eq("id", propositionPageId)
        .maybeSingle()
      if (data) {
        setOwnerNotifyDaily(Boolean(data.owner_notify_daily))
        setOwnerVoteThreshold(data.owner_vote_threshold ?? null)
      }
    }
    fetchOwnerSettings()
  }, [propositionPageId])

  const handleVote = async (type: "Upvote" | "Downvote") => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setError("Supabase non configuré.")
      return
    }

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push(`/login?next=/propositions/${propositionId}`)
      return
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("id")
      .eq("id", userData.user.id)
      .maybeSingle()

    if (!userRow) {
      setCommentsError(
        "Profil utilisateur manquant. Veuillez vous déconnecter/reconnecter."
      )
      setCommentSubmitting(false)
      return
    }


    setLoading(true)
    setError(null)
    const { error: voteError } = await supabase.from("votes").upsert(
      {
        user_id: userData.user.id,
        proposition_id: propositionId,
        type,
      },
      { onConflict: "user_id,proposition_id" }
    )

    if (voteError) {
      setError(voteError.message)
      setLoading(false)
      return
    }

    setCurrentVote(type)
    const previousVotes = votes
    const nextVotes = await refreshVotes()
    if (
      propositionPageId &&
      !ownerNotifyDaily &&
      ownerVoteThreshold &&
      nextVotes !== undefined &&
      nextVotes !== null &&
      previousVotes < ownerVoteThreshold &&
      nextVotes >= ownerVoteThreshold
    ) {
      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "owner_vote_threshold",
          propositionId,
          actorUserId: userData.user.id,
        }),
      }).catch(() => null)
    }
    setLoading(false)
  }

  const handleSubmitComment = async () => {
    if (!commentValue.trim()) return
    const supabase = getSupabaseClient()
    if (!supabase) {
      setCommentsError("Supabase non configuré.")
      return
    }

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push(`/login?next=/propositions/${propositionId}`)
      return
    }


    setCommentSubmitting(true)
    setCommentsError(null)
    const { data: insertedComment, error: insertError } = await supabase
      .from("comments")
      .insert({
        proposition_id: propositionId,
        user_id: userData.user.id,
        content: commentValue.trim(),
      })
      .select("id")
      .single()

    if (insertError) {
      setCommentsError(insertError.message)
      setCommentSubmitting(false)
      return
    }

    setCommentValue("")
    await fetchComments()
    fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "comment_created",
        propositionId,
        commentId: insertedComment?.id,
        actorUserId: userData.user.id,
      }),
    }).catch(() => null)
    setCommentSubmitting(false)
  }

  const handleStatusChange = async (nextStatus: string) => {
    if (!isOwner) return
    const supabase = getSupabaseClient()
    if (!supabase) {
      setError("Supabase non configuré.")
      return
    }
    setLoading(true)
    setError(null)
    const { error: updateError } = await supabase
      .from("propositions")
      .update({ status: nextStatus })
      .eq("id", propositionId)
    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }
    setStatus(nextStatus)
    if (nextStatus === "Done") {
      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "status_done",
          propositionId,
          actorUserId: currentUserId,
        }),
      }).catch(() => null)
    }
    fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "status_change",
        propositionId,
        actorUserId: currentUserId,
        newStatus: nextStatus,
      }),
    }).catch(() => null)
    setLoading(false)
  }

  const handleVolunteerSubmit = async () => {
    if (propositionPageId) return
    if (!volunteerSkills.trim()) return
    const supabase = getSupabaseClient()
    if (!supabase) {
      setVolunteersError("Supabase non configuré.")
      return
    }
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push(`/login?next=/propositions/${propositionId}`)
      return
    }
    setVolunteerSubmitting(true)
    setVolunteersError(null)
    const { error: upsertError } = await supabase
      .from("volunteers")
      .upsert(
        {
          user_id: userData.user.id,
          proposition_id: propositionId,
          skills_offered: volunteerSkills.trim(),
          status: "Pending",
        },
        { onConflict: "user_id,proposition_id" }
      )
    if (upsertError) {
      setVolunteersError(upsertError.message)
      setVolunteerSubmitting(false)
      return
    }
    setVolunteerSkills("")
    await fetchVolunteers()
    fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "volunteer_created",
        propositionId,
        actorUserId: userData.user.id,
      }),
    }).catch(() => null)
    setVolunteerSubmitting(false)
  }

  const handleToggleSolution = async (commentId: string, nextValue: boolean) => {
    if (!isAuthor) return
    const supabase = getSupabaseClient()
    if (!supabase) {
      setCommentsError("Supabase non configuré.")
      return
    }
    setCommentsError(null)
    if (nextValue) {
      await supabase
        .from("comments")
        .update({ is_solution: false })
        .eq("proposition_id", propositionId)
    }
    const { error: updateError } = await supabase
      .from("comments")
      .update({ is_solution: nextValue })
      .eq("id", commentId)
    if (updateError) {
      setCommentsError(updateError.message)
      return
    }
    await fetchComments()
    fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: nextValue ? "solution_marked" : "solution_unmarked",
        propositionId,
        commentId,
        actorUserId: currentUserId,
      }),
    }).catch(() => null)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-2">
          <CardTitle className="text-lg">Votes</CardTitle>
          <Badge variant="outline" className="w-fit">
            Statut: {status}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
        <div className="text-2xl font-semibold text-foreground">
          {Math.max(0, votes)} votes
        </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {isOwner && (
            <div className="flex flex-wrap gap-2">
              {["Open", "In Progress", "Done", "Won't Do"].map((nextStatus) => (
                <Button
                  key={nextStatus}
                  variant={status === nextStatus ? "default" : "outline"}
                  onClick={() => handleStatusChange(nextStatus)}
                  disabled={loading}
                >
                  {nextStatus}
                </Button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={currentVote === "Upvote" ? "default" : "outline"}
              onClick={() => handleVote("Upvote")}
              disabled={loading}
            >
              Upvote
            </Button>
            <Button
              variant={currentVote === "Downvote" ? "destructive" : "outline"}
              onClick={() => handleVote("Downvote")}
              disabled={loading}
            >
              Downvote
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Volontaires</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={volunteerSkills}
            onChange={(event) => setVolunteerSkills(event.target.value)}
            placeholder="Compétences que vous pouvez apporter..."
            rows={3}
          />
          <div className="flex justify-end">
            <Button
              onClick={handleVolunteerSubmit}
              disabled={volunteerSubmitting || !volunteerSkills.trim()}
            >
              Se déclarer volontaire
            </Button>
          </div>
          {volunteersError && (
            <p className="text-sm text-destructive">{volunteersError}</p>
          )}
          {volunteersLoading && (
            <p className="text-sm text-muted-foreground">
              Chargement des volontaires...
            </p>
          )}
          {!volunteersLoading && volunteers.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucun volontaire pour le moment.
            </p>
          )}
          <div className="space-y-3">
            {volunteers.map((volunteer) => (
              <div
                key={volunteer.user_id}
                className="rounded-lg border border-border bg-background/60 p-3"
              >
                <p className="text-xs font-medium text-muted-foreground">
                  {getUserMeta(volunteer.users)?.username ||
                    getUserMeta(volunteer.users)?.email ||
                    "Anonyme"}
                </p>
                <p className="text-sm text-foreground">
                  {volunteer.skills_offered ?? "Compétences non précisées."}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Statut: {volunteer.status ?? "Pending"}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Commentaires</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={commentValue}
            onChange={(event) => setCommentValue(event.target.value)}
            placeholder="Ajouter un commentaire..."
            rows={4}
          />
          <div className="flex justify-end">
            <Button onClick={handleSubmitComment} disabled={commentSubmitting}>
              Publier
            </Button>
          </div>
          {commentsError && (
            <p className="text-sm text-destructive">{commentsError}</p>
          )}
          {commentsLoading && (
            <p className="text-sm text-muted-foreground">
              Chargement des commentaires...
            </p>
          )}
          {!commentsLoading && comments.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucun commentaire pour le moment.
            </p>
          )}
          <div className="space-y-3">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="rounded-lg border border-border bg-background/60 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {getUserMeta(comment.users)?.username ||
                      getUserMeta(comment.users)?.email ||
                      "Anonyme"}
                  </p>
                  {comment.is_solution && (
                    <Badge variant="secondary">Solution validée</Badge>
                  )}
                </div>
                <p className="text-sm text-foreground">{comment.content}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(comment.created_at).toLocaleString("fr-FR")}
                </p>
                {isAuthor && (
                  <div className="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleToggleSolution(comment.id, !comment.is_solution)
                      }
                    >
                      {comment.is_solution
                        ? "Retirer la solution"
                        : "Marquer comme solution"}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
