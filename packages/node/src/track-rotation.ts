/**
 * The multiplayer track rotation with votes (pure logic, no server): a list of tracks played in
 * order, one current track, and at most one vote per voter for the next one.
 *
 * - The next track is the one with the most votes; a tie goes to the track that comes first in
 *   rotation order after the current one. With no votes it is simply the next in rotation order.
 * - Voting for the current track means "this one again".
 * - {@link advance} makes the next track current and clears all votes; the rotation then continues
 *   from the new current track (also after a voted jump).
 */
export class TrackRotation<Voter = unknown> {
  private index: number;
  private readonly votes = new Map<Voter, string>();

  constructor(
    readonly tracks: readonly string[],
    current: string = tracks[0] ?? "",
  ) {
    if (tracks.length === 0) throw new Error("a rotation needs at least one track");
    if (new Set(tracks).size !== tracks.length)
      throw new Error(`duplicate tracks in rotation: ${tracks.join(", ")}`);
    const index = tracks.indexOf(current);
    if (index < 0) throw new Error(`track ${JSON.stringify(current)} is not in the rotation`);
    this.index = index;
  }

  get current(): string {
    return this.tracks[this.index]!;
  }

  /** All tracks in rotation order after the current one; the current track comes last. */
  order(): string[] {
    const n = this.tracks.length;
    return Array.from({ length: n }, (_, i) => this.tracks[(this.index + 1 + i) % n]!);
  }

  /** Records `voter`'s vote (replacing an earlier one). False for a track not in the rotation. */
  vote(voter: Voter, track: string): boolean {
    if (!this.tracks.includes(track)) return false;
    this.votes.set(voter, track);
    return true;
  }

  /** Removes `voter`'s vote (they left). True if there was one. */
  withdraw(voter: Voter): boolean {
    return this.votes.delete(voter);
  }

  voteOf(voter: Voter): string | undefined {
    return this.votes.get(voter);
  }

  get voteCount(): number {
    return this.votes.size;
  }

  /** Votes per track, in rotation order, tracks without votes left out. */
  tally(): { track: string; votes: number }[] {
    const counts = new Map<string, number>();
    for (const track of this.votes.values()) counts.set(track, (counts.get(track) ?? 0) + 1);
    return this.order()
      .filter((track) => counts.has(track))
      .map((track) => ({ track, votes: counts.get(track)! }));
  }

  get next(): string {
    let best: { track: string; votes: number } | undefined;
    // Rotation order, so the first of tied tracks wins.
    for (const entry of this.tally()) if (!best || entry.votes > best.votes) best = entry;
    return best?.track ?? this.order()[0]!;
  }

  /** Why {@link next} is next. */
  get nextBy(): "vote" | "rotation" {
    return this.votes.size > 0 ? "vote" : "rotation";
  }

  /** Makes the next track current, clears the votes, and returns the new current track. */
  advance(): string {
    this.index = this.tracks.indexOf(this.next);
    this.votes.clear();
    return this.current;
  }
}
