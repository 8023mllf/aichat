export class AudioQueue {
  private queue: Blob[] = [];
  private playing = false;

  async enqueue(blob: Blob) {
    this.queue.push(blob);
    if (!this.playing) this.playNext();
  }

  private async playNext() {
    const blob = this.queue.shift();
    if (!blob) { this.playing = false; return; }
    this.playing = true;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    await audio.play().catch(()=>{});
    audio.onended = () => {
      URL.revokeObjectURL(url);
      this.playNext();
    };
  }
}
