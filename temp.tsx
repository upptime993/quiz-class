  // â”€â”€ CREATE / EDIT VIEW â”€â”€
  return (
    <div className="min-h-screen px-5 py-6 relative z-10 max-w-md mx-auto">
      <ParticleBackground />
      <ToastComponent />

      {/* AI Loading Modal */}
      <AILoadingModal visible={isGeneratingAI} />

      {/* Header */}
      <div className="flex items-center gap-3 mb-5 animate-slide-down">
        <button
          onClick={() => { resetForm(); setView("list"); }}
          className="p-2 rounded-xl"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          â†
        </button>
        <div>
          <h1
            className="text-xl font-black"
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--text-primary)",
            }}
          >
            {view === "create" ? "âž• Buat Quiz Baru" : "âœï¸ Edit Quiz"}
          </h1>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {questions.length} soal ditambahkan
          </p>
        </div>
      </div>

      {/* Quiz Info */}
      <GlassCard className="p-4 mb-4 animate-slide-up" animate={false}>
        <p
          className="text-xs font-bold mb-3 uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Info Quiz
        </p>
        <div className="space-y-3">
          <InputField
            placeholder="Judul Quiz (contoh: Quiz IPA Bab 3)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            icon={<span>ðŸ“</span>}
          />
          <InputField
            placeholder="Deskripsi (opsional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            icon={<span>ðŸ“„</span>}
          />
          <div>
            <label
              className="block text-xs font-bold mb-2"
              style={{ color: "var(--text-secondary)" }}
            >
              â±ï¸ Durasi per soal: {defaultDuration} detik
            </label>
            <input
              type="range"
              min={5}
              max={120}
              step={5}
              value={defaultDuration}
              onChange={(e) => setDefaultDuration(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: "var(--accent-purple)" }}
            />
            <div
              className="flex justify-between text-xs mt-1"
              style={{ color: "var(--text-muted)" }}
            >
              <span>5s</span>
              <span>120s</span>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* CSV Import / Export / AI */}
      <div className="flex flex-col gap-2 mb-4 animate-slide-up" style={{ animationDelay: "0.1s" }}>
        
        {showAIPrompt && (
          <GlassCard className="p-3">
            <p className="text-xs font-bold mb-2" style={{ color: "var(--text-muted)" }}>
              ðŸ¤– Prompt AI Generator
            </p>
            <textarea
              className="input-field resize-none mb-2"
              rows={3}
              placeholder="Contoh: Buatkan 10 soal Matematika SMP kelas 7 tentang persamaan linear..."
              value={aiPrompt}
              onChange={(e) => setAIPrompt(e.target.value)}
              style={{ fontFamily: "var(--font-body)" }}
            />
            <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
              ðŸ’¡ Tips: Sebutkan jumlah soal, mata pelajaran, kelas, dan topik
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setShowAIPrompt(false)} style={{ background: "rgba(255,255,255,0.05)" }} className="flex-1 text-sm py-1">Batal</Button>
              <Button onClick={handleGenerateAI} loading={false} disabled={isGeneratingAI} variant="green" className="flex-1 text-sm py-1">âœ¨ Generate dengan AI</Button>
            </div>
          </GlassCard>
        )}

        <div className="grid grid-cols-3 gap-2">
          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={importRef}
            onChange={handleImportCSV}
          />
          <Button
            onClick={() => importRef.current?.click()}
            variant="primary"
            className="flex-1 text-sm !py-2"
          >
            ðŸ“¥ Import CSV
          </Button>
          <Button
            onClick={handleDownloadCSVTemplate}
            className="flex-1 text-sm !py-2"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            â¬‡ï¸ Template
          </Button>
          <Button
            onClick={() => setShowAIPrompt(!showAIPrompt)}
            variant="purple"
            className="flex-1 text-sm !py-2"
          >
            âœ¨ AI
          </Button>
        </div>
      </div>

      {/* Question Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
        {questions.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveQIdx(i)}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={{
              background:
                activeQIdx === i
                  ? "var(--accent-purple)"
                  : "var(--bg-elevated)",
              color:
                activeQIdx === i ? "white" : "var(--text-secondary)",
              border: `1px solid ${activeQIdx === i ? "var(--accent-purple)" : "var(--border)"}`,
            }}
          >
            Soal {i + 1}
          </button>
        ))}
        <button
          onClick={addQuestion}
          className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold"
          style={{
            background: "rgba(0,184,148,0.12)",
            color: "var(--accent-green)",
            border: "1px solid rgba(0,184,148,0.25)",
          }}
        >
          + Tambah
        </button>
      </div>

      {/* Question Editor */}
      {activeQuestion && (
        <GlassCard className="p-4 mb-4 animate-fade-in" animate={false}>
          <div className="flex items-center justify-between mb-3">
            <p
              className="text-sm font-bold"
              style={{
                color: "var(--accent-purple-light)",
                fontFamily: "var(--font-heading)",
              }}
            >
              ðŸ“ Soal {activeQIdx + 1}
            </p>
            {questions.length > 1 && (
              <button
                onClick={() => removeQuestion(activeQIdx)}
                className="text-xs font-bold px-2 py-1 rounded-lg"
                style={{
                  color: "var(--accent-red)",
                  background: "rgba(255,107,107,0.1)",
                }}
              >
                ðŸ—‘ï¸ Hapus Soal
              </button>
            )}
          </div>

          <div className="space-y-3">
            {/* Question text */}
            <div>
              <label
                className="block text-xs font-bold mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                Teks Soal *
              </label>
              <textarea
                className="input-field resize-none"
                rows={3}
                placeholder="Ketik pertanyaan di sini..."
                value={activeQuestion.text}
                onChange={(e) =>
                  updateQuestion(activeQIdx, "text", e.target.value)
                }
                style={{ fontFamily: "var(--font-body)" }}
              />
            </div>

            {/* Image upload */}
            <div>
              <label
                className="block text-xs font-bold mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                ðŸ–¼ï¸ Gambar (opsional)
              </label>
              {activeQuestion.imageUrl ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeQuestion.imageUrl}
                    alt="Gambar soal"
                    className="w-full rounded-xl object-cover"
                    style={{ maxHeight: 160, minHeight: 80, background: "var(--bg-elevated)" }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <button
                    onClick={() =>
                      updateQuestion(activeQIdx, "imageUrl", null)
                    }
                    className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs"
                    style={{
                      background: "rgba(255,107,107,0.9)",
                      color: "white",
                    }}
                  >
                    âœ•
                  </button>
                  <p className="text-xs mt-1 truncate" style={{ color: "var(--text-muted)" }}>
                    {activeQuestion.imageUrl}
                  </p>
                </div>
              ) : (
                <label
                  className="flex flex-col items-center justify-center p-4 rounded-xl cursor-pointer transition-all"
                  style={{
                    border: "2px dashed var(--border)",
                    background: "var(--bg-elevated)",
                  }}
                >
                  <span style={{ fontSize: 28 }}>
                    {uploadingImg === activeQIdx ? "â³" : "ðŸ“·"}
                  </span>
                  <span
                    className="text-xs mt-1 font-semibold"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {uploadingImg === activeQIdx
                      ? "Mengupload..."
                      : "Tap untuk upload gambar"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingImg !== null}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(activeQIdx, file);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>

            {/* Duration per question */}
            <div>
              <label
                className="block text-xs font-bold mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                â±ï¸ Durasi soal ini: {activeQuestion.duration}s
              </label>
              <input
                type="range"
                min={5}
                max={120}
                step={5}
                value={activeQuestion.duration}
                onChange={(e) =>
                  updateQuestion(
                    activeQIdx,
                    "duration",
                    Number(e.target.value)
                  )
                }
                className="w-full"
                style={{ accentColor: "var(--accent-purple)" }}
              />
            </div>

            {/* Answer Type Toggle â€” 3 options */}
            <div>
              <label
                className="block text-xs font-bold mb-2"
                style={{ color: "var(--text-muted)" }}
              >
                ðŸ”¤ Tipe Jawaban
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { type: "multiple_choice", label: "ðŸ”˜ Pilihan Ganda" },
                  { type: "text", label: "âœï¸ Jawaban Teks" },
                  { type: "matching", label: "ðŸ”— Penjodohan" },
                ].map(({ type, label }) => (
                  <button
                    key={type}
                    onClick={() => {
                      if (type === "multiple_choice") {
                        updateQuestionMulti(activeQIdx, {
                          answerType: "multiple_choice",
                          correctAnswer: "A",
                          options: [
                            { label: "A", text: "" },
                            { label: "B", text: "" },
                            { label: "C", text: "" },
                            { label: "D", text: "" },
                          ],
                          matchPairs: [],
                        });
                      } else if (type === "text") {
                        updateQuestionMulti(activeQIdx, {
                          answerType: "text",
                          correctAnswer: "TEXT",
                          options: [],
                          acceptedAnswers: activeQuestion.acceptedAnswers?.length
                            ? activeQuestion.acceptedAnswers
                            : [""],
                          matchPairs: [],
                        });
                      } else {
                        updateQuestionMulti(activeQIdx, {
                          answerType: "matching",
                          correctAnswer: "MATCHING",
                          options: [],
                          matchPairs: activeQuestion.matchPairs?.length
                            ? activeQuestion.matchPairs
                            : [{ left: "", right: "" }, { left: "", right: "" }, { left: "", right: "" }],
                        });
                      }
                    }}
                    className="py-2 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background:
                        activeQuestion.answerType === type
                          ? "var(--accent-purple)"
                          : "var(--bg-elevated)",
                      color:
                        activeQuestion.answerType === type
                          ? "white"
                          : "var(--text-secondary)",
                      border: `1px solid ${
                        activeQuestion.answerType === type
                          ? "var(--accent-purple)"
                          : "var(--border)"
                      }`,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Options - Multiple Choice */}
            {activeQuestion.answerType === "multiple_choice" && (
              <div>
                <label
                  className="block text-xs font-bold mb-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  Pilihan Jawaban *
                </label>
                <div className="space-y-2">
                  {activeQuestion.options.map((opt) => (
                    <div key={opt.label} className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          updateQuestion(
                            activeQIdx,
                            "correctAnswer",
                            opt.label
                          )
                        }
                        className="flex-shrink-0 w-9 h-9 rounded-xl font-bold text-sm transition-all"
                        style={{
                          background:
                            activeQuestion.correctAnswer === opt.label
                              ? "var(--accent-green)"
                              : "var(--bg-elevated)",
                          color:
                            activeQuestion.correctAnswer === opt.label
                              ? "white"
                              : "var(--text-secondary)",
                          border: `2px solid ${
                            activeQuestion.correctAnswer === opt.label
                              ? "var(--accent-green)"
                              : "var(--border)"
                          }`,
                        }}
                      >
                        {activeQuestion.correctAnswer === opt.label
                          ? "âœ“"
                          : opt.label}
                      </button>
                      <input
                        className="input-field flex-1"
                        style={{ padding: "10px 14px" }}
                        placeholder={`Pilihan ${opt.label}`}
                        value={opt.text}
                        onChange={(e) =>
                          updateOption(activeQIdx, opt.label, e.target.value)
                        }
                      />
                    </div>
                  ))}
                </div>
                <p
                  className="text-xs mt-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  ðŸ’¡ Tap huruf (A/B/C/D) untuk menandai jawaban benar
                </p>
              </div>
            )}

            {/* Options - Text Answer Mode */}
            {activeQuestion.answerType === "text" && (
              <div>
                <label
                  className="block text-xs font-bold mb-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  âœ… Jawaban yang Diterima *
                </label>
                <p
                  className="text-xs mb-3"
                  style={{ color: "var(--text-muted)" }}
                >
                  ðŸ’¡ Tambahkan variasi jawaban yang dianggap benar (tidak case-sensitive)
                </p>
                <div className="space-y-2">
                  {(activeQuestion.acceptedAnswers || [""]).map((ans, ansIdx) => (
                    <div key={ansIdx} className="flex items-center gap-2">
                      <div
                        className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                        style={{
                          background: "rgba(0,184,148,0.15)",
                          color: "var(--accent-green)",
                          border: "1px solid rgba(0,184,148,0.3)",
                        }}
                      >
                        {ansIdx + 1}
                      </div>
                      <input
                        className="input-field flex-1"
                        style={{ padding: "10px 14px" }}
                        placeholder={`Jawaban benar ${ansIdx + 1}`}
                        value={ans}
                        onChange={(e) => {
                          const updated = [...(activeQuestion.acceptedAnswers || [])];
                          updated[ansIdx] = e.target.value;
                          updateQuestion(activeQIdx, "acceptedAnswers", updated);
                        }}
                      />
                      {(activeQuestion.acceptedAnswers || []).length > 1 && (
                        <button
                          onClick={() => {
                            const updated = (activeQuestion.acceptedAnswers || []).filter(
                              (_, i) => i !== ansIdx
                            );
                            updateQuestion(activeQIdx, "acceptedAnswers", updated);
                          }}
                          className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs"
                          style={{
                            color: "var(--accent-red)",
                            background: "rgba(255,107,107,0.1)",
                          }}
                        >
                          âœ•
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    const updated = [...(activeQuestion.acceptedAnswers || []), ""];
                    updateQuestion(activeQIdx, "acceptedAnswers", updated);
                  }}
                  className="w-full mt-2 py-2 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: "rgba(0,184,148,0.1)",
                    color: "var(--accent-green)",
                    border: "1px dashed rgba(0,184,148,0.3)",
                  }}
                >
                  + Tambah Variasi Jawaban
                </button>
              </div>
            )}

            {/* Options - Matching Mode */}
            {activeQuestion.answerType === "matching" && (
              <div>
                <label
                  className="block text-xs font-bold mb-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  ðŸ”— Pasangan Penjodohan *
                </label>
                <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
                  ðŸ’¡ Isi pasangan kiri â†” kanan. Minimal 2 pasangan. Siswa akan menjodohkan secara interaktif.
                </p>
                <div className="space-y-2">
                  {(activeQuestion.matchPairs || []).map((pair, pairIdx) => (
                    <div key={pairIdx} className="flex items-center gap-2">
                      <div
                        className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold"
                        style={{
                          background: "rgba(108,92,231,0.15)",
                          color: "var(--accent-purple-light)",
                          border: "1px solid rgba(108,92,231,0.3)",
                        }}
                      >
                        {pairIdx + 1}
                      </div>
                      <input
                        className="input-field flex-1"
                        style={{ padding: "8px 12px", fontSize: 13 }}
                        placeholder={`Soal ${pairIdx + 1}`}
                        value={pair.left}
                        onChange={(e) => updateMatchPair(activeQIdx, pairIdx, "left", e.target.value)}
                      />
                      <span style={{ color: "var(--text-muted)", fontSize: 12, flexShrink: 0 }}>â†”</span>
                      <input
                        className="input-field flex-1"
                        style={{ padding: "8px 12px", fontSize: 13 }}
                        placeholder={`Jawaban ${pairIdx + 1}`}
                        value={pair.right}
                        onChange={(e) => updateMatchPair(activeQIdx, pairIdx, "right", e.target.value)}
                      />
                      {(activeQuestion.matchPairs || []).length > 2 && (
                        <button
                          onClick={() => removeMatchPair(activeQIdx, pairIdx)}
                          className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs"
                          style={{
                            color: "var(--accent-red)",
                            background: "rgba(255,107,107,0.1)",
                          }}
                        >
                          âœ•
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => addMatchPair(activeQIdx)}
                  className="w-full mt-2 py-2 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: "rgba(108,92,231,0.1)",
                    color: "var(--accent-purple-light)",
                    border: "1px dashed rgba(108,92,231,0.3)",
                  }}
                >
                  + Tambah Pasangan
                </button>
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* Save Button */}
      <Button onClick={handleSave} loading={saving} className="mb-4">
        <span>{view === "create" ? "ðŸŽ‰" : "âœ…"}</span>
        <span>
          {view === "create" ? "Simpan Quiz!" : "Perbarui Quiz!"}
        </span>
      </Button>
    </div>
  );
}
