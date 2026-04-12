const fs = require('fs');

const path = './frontend/app/admin/quiz/page.tsx';
let txt = fs.readFileSync(path, 'utf8');

// Temukan indeks "  // ── CREATE / EDIT VIEW ──"
const targetStr = "  // ── CREATE / EDIT VIEW ──";
const startIndex = txt.indexOf(targetStr);

if (startIndex === -1) {
  console.log("Kata kunci tidak ditemukan");
  process.exit(1);
}

const topPart = txt.substring(0, startIndex);

const newContent = `  // ── CREATE / EDIT VIEW ──
  return (
    <div className="min-h-screen px-4 md:px-6 py-8 relative z-10 w-full max-w-2xl mx-auto flex flex-col gap-6 font-sans">
      <ParticleBackground />
      <ToastComponent />

      {/* AI Loading Modal */}
      <AILoadingModal visible={isGeneratingAI} />

      {/* Header Sticky-ish */}
      <div className="flex items-center gap-4 animate-slide-down sticky top-4 z-30 bg-[rgba(10,10,15,0.85)] backdrop-blur-xl p-4 rounded-3xl border border-[rgba(255,255,255,0.05)] shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
        <button
          onClick={() => { resetForm(); setView("list"); }}
          className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all hover:-translate-x-1"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "var(--text-secondary)",
          }}
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <h1
            className="text-xl md:text-2xl font-black bg-gradient-to-r from-white to-[var(--accent-purple-light)] bg-clip-text text-transparent truncate"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {view === "create" ? "Buat Quiz Baru" : "Edit Quiz"}
          </h1>
          <p className="text-xs font-medium" style={{ color: "var(--accent-purple-light)" }}>
            {questions.length} Soal Tersusun
          </p>
        </div>
        <Button 
           onClick={handleSave} 
           loading={saving} 
           className="px-5 py-2.5 rounded-2xl text-sm whitespace-nowrap shadow-[0_0_20px_rgba(108,92,231,0.3)] hover:shadow-[0_0_30px_rgba(108,92,231,0.6)] font-bold transition-all"
        >
          {view === "create" ? "Simpan" : "Perbarui"}
        </Button>
      </div>

      {/* Quick Action Pills */}
      <div className="flex flex-wrap gap-2 animate-fade-in" style={{ animationDelay: "0.1s" }}>
        <button
          onClick={() => setShowAIPrompt(!showAIPrompt)}
          className={\`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border \${
             showAIPrompt 
             ? "bg-[rgba(108,92,231,0.2)] text-[var(--accent-purple-light)] border-[var(--accent-purple)] shadow-[0_0_15px_rgba(108,92,231,0.4)]" 
             : "bg-[rgba(255,255,255,0.03)] text-[var(--text-secondary)] border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.08)]"
          }\`}
        >
          <span className={\`\${showAIPrompt ? "animate-pulse" : ""}\`}>✨</span> AI Generator
        </button>
        
        <input type="file" accept=".csv" className="hidden" ref={importRef} onChange={handleImportCSV} />
        
        <button
          onClick={() => importRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all bg-[rgba(255,255,255,0.03)] text-[var(--text-secondary)] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.08)]"
        >
          📥 Import CSV
        </button>
        
        <button
          onClick={handleDownloadCSVTemplate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all bg-[rgba(255,255,255,0.03)] text-[var(--text-secondary)] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.08)]"
        >
          🧾 Template
        </button>
      </div>

      {/* AI Panel Expansion */}
      {showAIPrompt && (
        <div className="relative animate-slide-down">
          {/* Neon Border Glow */}
          <div className="absolute -inset-[1px] bg-gradient-to-r from-[var(--accent-purple)] to-[var(--accent-blue)] rounded-3xl opacity-50 blur-[4px] animate-pulse-glow" />
          <div className="relative bg-[rgba(19,19,26,0.9)] backdrop-blur-2xl p-5 rounded-3xl border border-[rgba(255,255,255,0.1)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-purple)] to-[var(--accent-blue)] flex items-center justify-center text-sm shadow-[0_0_15px_rgba(108,92,231,0.5)] animate-bounce-idle">🤖</div>
              <div>
                <p className="text-sm font-bold text-white tracking-wide" style={{ fontFamily: "var(--font-heading)" }}>Sihir AI Generator</p>
                <p className="text-[10px] text-[var(--text-muted)]">Ketik topik & biarkan AI membuat soal untukmu.</p>
              </div>
            </div>
            
            <textarea
              className="w-full bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.05)] rounded-2xl p-4 text-sm text-white placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-purple)] focus:bg-[rgba(108,92,231,0.05)] transition-all resize-none shadow-inner"
              rows={3}
              placeholder="Cth: Buatkan 5 soal IPA Kelas 8 tentang Tata Surya beserta opsi dan jawaban benar..."
              value={aiPrompt}
              onChange={(e) => setAIPrompt(e.target.value)}
              style={{ fontFamily: "var(--font-body)" }}
            />
            
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowAIPrompt(false)} className="flex-1 py-3 text-xs font-bold text-[var(--text-muted)] hover:text-white transition-colors bg-[rgba(255,255,255,0.02)] rounded-xl border border-[rgba(255,255,255,0.05)]">Batal</button>
              <button 
                onClick={handleGenerateAI} 
                disabled={isGeneratingAI} 
                className="flex-[2] py-3 text-xs font-extrabold text-white rounded-xl shadow-[0_4px_15px_rgba(0,184,148,0.4)] hover:shadow-[0_6px_25px_rgba(0,184,148,0.6)] transition-all overflow-hidden relative group"
                style={{ background: "linear-gradient(135deg, #00B894, #00cec9)" }}
              >
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
                ✨ Hasilkan Soal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quiz Details Card */}
      <div className="bg-[rgba(19,19,26,0.5)] backdrop-blur-xl p-6 rounded-3xl border border-[rgba(255,255,255,0.06)] shadow-[0_8px_30px_rgba(0,0,0,0.4)] relative overflow-hidden animate-slide-up" style={{ animationDelay: "0.2s" }}>
        {/* Subtle decorative glow inside card */}
        <div className="absolute -top-[50px] -right-[50px] w-32 h-32 bg-[var(--accent-purple)] opacity-20 blur-[60px] rounded-full pointer-events-none" />
        
        <div className="flex items-center gap-3 mb-5">
          <span className="p-2 bg-[rgba(255,255,255,0.05)] rounded-xl text-lg">📝</span>
          <h2 className="text-base font-extrabold text-white tracking-wide" style={{ fontFamily: "var(--font-heading)" }}>Informasi Utama</h2>
        </div>

        <div className="space-y-4 relative z-10">
          <InputField
            placeholder="Judul Quiz (Cth: Mid-Semester IPA)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ backgroundColor: "rgba(0,0,0,0.2)", borderRadius: "16px" }}
          />
          <InputField
            placeholder="Deskripsi singkat (Opsional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ backgroundColor: "rgba(0,0,0,0.2)", borderRadius: "16px" }}
          />
          
          <div className="bg-[rgba(0,0,0,0.2)] p-4 rounded-2xl border border-[rgba(255,255,255,0.02)] mt-2">
            <label className="flex items-center justify-between text-xs font-bold mb-3 text-[var(--text-secondary)]">
              <span>⏱️ Default Durasi Menjawab</span>
              <span className="bg-[var(--accent-purple)] px-3 py-1 rounded-full text-white shadow-[0_0_10px_rgba(108,92,231,0.4)]">{defaultDuration} Detik</span>
            </label>
            <div className="relative pt-1">
              <input
                type="range"
                min={5} max={120} step={5}
                value={defaultDuration}
                onChange={(e) => setDefaultDuration(Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer outline-none"
                style={{
                  background: \`linear-gradient(90deg, var(--accent-purple) \${(defaultDuration - 5) / (120 - 5) * 100}%, rgba(255,255,255,0.1) \${(defaultDuration - 5) / (120 - 5) * 100}%)\`
                }}
              />
              <style jsx>{\`
                input[type=range]::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  width: 16px;
                  height: 16px;
                  border-radius: 50%;
                  background: white;
                  box-shadow: 0 0 10px rgba(108,92,231,0.8);
                  cursor: pointer;
                }
              \`}</style>
            </div>
          </div>
        </div>
      </div>

      {/* Ribbon Pills Navigation for Questions */}
      <div className="flex gap-3 overflow-x-auto pb-4 pt-1 px-1 custom-scrollbar -mx-4 md:mx-0 px-4 md:px-0 animate-slide-up" style={{ animationDelay: "0.3s" }}>
        {questions.map((_, i) => {
          const isActive = activeQIdx === i;
          return (
            <button
              key={i}
              onClick={() => setActiveQIdx(i)}
              className={\`relative flex-shrink-0 px-5 py-2.5 rounded-2xl text-xs font-extrabold transition-all duration-300 \${
                isActive 
                ? "text-white shadow-[0_8px_20px_rgba(108,92,231,0.4)] -translate-y-1" 
                : "bg-[rgba(255,255,255,0.03)] text-[var(--text-muted)] hover:bg-[rgba(255,255,255,0.08)] hover:text-white border border-[rgba(255,255,255,0.05)]"
              }\`}
            >
              {isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent-purple)] to-[var(--accent-purple-dark)] rounded-2xl border border-[rgba(255,255,255,0.2)] -z-10" />
              )}
              Soal {i + 1}
            </button>
          );
        })}
        <button
          onClick={addQuestion}
          className="flex-shrink-0 px-5 py-2.5 rounded-2xl text-xs font-extrabold border border-dashed border-[var(--accent-green)] text-[var(--accent-green)] hover:bg-[rgba(0,184,148,0.1)] transition-all flex items-center justify-center gap-1 hover:-translate-y-1"
        >
          <span className="text-lg leading-none">+</span> Tambah
        </button>
      </div>

      {/* Editor Soal (Question Editor) */}
      {activeQuestion && (
        <div key={activeQIdx} className="bg-[rgba(19,19,26,0.6)] backdrop-blur-2xl p-6 rounded-[32px] border border-[rgba(255,255,255,0.08)] shadow-[0_15px_50px_rgba(0,0,0,0.5)] animate-fade-in relative">
          
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[rgba(255,255,255,0.05)]">
            <h3 className="text-lg font-black text-white flex items-center gap-2" style={{ fontFamily: "var(--font-heading)" }}>
              <span className="bg-[var(--accent-purple)] text-white w-8 h-8 flex items-center justify-center rounded-xl text-sm shadow-[0_4px_10px_rgba(108,92,231,0.5)]">{activeQIdx + 1}</span>
              Desain Soal
            </h3>
            {questions.length > 1 && (
              <button
                onClick={() => removeQuestion(activeQIdx)}
                className="text-xs font-bold px-3 py-1.5 rounded-lg text-[var(--accent-red)] bg-[rgba(255,107,107,0.1)] hover:bg-[rgba(255,107,107,0.2)] transition-colors border border-[rgba(255,107,107,0.2)] flex items-center gap-1.5"
              >
                <span>🗑️</span> Hapus
              </button>
            )}
          </div>

          <div className="space-y-6">
            
            {/* Teks Soal */}
            <div>
              <label className="block text-xs font-bold mb-2 ml-1 text-[var(--text-secondary)] uppercase tracking-wider">
                Pertanyaan Utama
              </label>
              <textarea
                className="w-full bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.05)] rounded-[20px] p-5 text-sm text-white placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-purple)] focus:bg-[rgba(108,92,231,0.05)] transition-all resize-none shadow-inner leading-relaxed"
                rows={4}
                placeholder="Menurut kamu, apa itu ruang angkasa?..."
                value={activeQuestion.text}
                onChange={(e) => updateQuestion(activeQIdx, "text", e.target.value)}
              />
            </div>

            {/* Durasi & Gambar Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {/* Durasi Individual */}
               <div className="bg-[rgba(255,255,255,0.02)] p-4 rounded-3xl border border-[rgba(255,255,255,0.03)] flex flex-col justify-center">
                  <label className="flex items-center justify-between text-xs font-bold mb-3 text-[var(--text-secondary)]">
                    <span>⏱️ Durasi Khusus</span>
                    <span className="text-[var(--accent-blue)]">{activeQuestion.duration}s</span>
                  </label>
                  <div className="relative pt-1">
                    <input
                      type="range" min={5} max={120} step={5}
                      value={activeQuestion.duration}
                      onChange={(e) => updateQuestion(activeQIdx, "duration", Number(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer outline-none"
                      style={{
                        background: \`linear-gradient(90deg, var(--accent-blue) \${(activeQuestion.duration - 5) / (120 - 5) * 100}%, rgba(255,255,255,0.1) \${(activeQuestion.duration - 5) / (120 - 5) * 100}%)\`
                      }}
                    />
                  </div>
               </div>

               {/* Sisipkan Gambar */}
               <div className="bg-[rgba(255,255,255,0.02)] p-3 rounded-3xl border border-[rgba(255,255,255,0.03)] h-full min-h-[100px] flex items-center justify-center relative overflow-hidden group">
                  {activeQuestion.imageUrl ? (
                    <div className="relative w-full h-full min-h-[100px] rounded-2xl overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={activeQuestion.imageUrl} alt="Lampiran" className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => updateQuestion(activeQIdx, "imageUrl", null)}
                          className="bg-[var(--accent-red)] text-white w-10 h-10 rounded-full flex items-center justify-center text-sm shadow-xl transform scale-75 group-hover:scale-100 transition-transform"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer py-4 opacity-70 hover:opacity-100 transition-opacity">
                      <div className="w-10 h-10 rounded-full bg-[rgba(255,255,255,0.05)] flex items-center justify-center text-lg mb-2 border border-[rgba(255,255,255,0.1)]">📷</div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
                        {uploadingImg === activeQIdx ? "Mengupload..." : "Tambah Gambar"}
                      </span>
                      <input
                        type="file" accept="image/*" className="hidden"
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
            </div>

            {/* Segmented Control: Tipe Jawaban */}
            <div className="pt-2">
              <label className="block text-xs font-bold mb-3 ml-1 text-[var(--text-secondary)] uppercase tracking-wider">
                Mode Jawaban
              </label>
              <div className="bg-[rgba(0,0,0,0.4)] p-1.5 rounded-2xl flex relative overflow-hidden border border-[rgba(255,255,255,0.05)] shadow-inner">
                {[
                  { type: "multiple_choice", icon: "🔘", label: "Opsi" },
                  { type: "text", icon: "✏️", label: "Teks" },
                  { type: "matching", icon: "🔗", label: "Jodoh" },
                ].map(({ type, icon, label }) => {
                  const isActive = activeQuestion.answerType === type;
                  return (
                    <button
                      key={type}
                      onClick={() => {
                        if (isActive) return;
                        if (type === "multiple_choice") {
                          updateQuestionMulti(activeQIdx, {
                            answerType: "multiple_choice",
                            correctAnswer: "A",
                            options: [
                              { label: "A", text: "" }, { label: "B", text: "" },
                              { label: "C", text: "" }, { label: "D", text: "" },
                            ],
                            matchPairs: [],
                          });
                        } else if (type === "text") {
                          updateQuestionMulti(activeQIdx, {
                            answerType: "text", correctAnswer: "TEXT", options: [],
                            acceptedAnswers: activeQuestion.acceptedAnswers?.length ? activeQuestion.acceptedAnswers : [""], matchPairs: [],
                          });
                        } else {
                          updateQuestionMulti(activeQIdx, {
                            answerType: "matching", correctAnswer: "MATCHING", options: [],
                            matchPairs: activeQuestion.matchPairs?.length ? activeQuestion.matchPairs : [{ left: "", right: "" }, { left: "", right: "" }, { left: "", right: "" }],
                          });
                        }
                      }}
                      className={\`flex-1 flex justify-center items-center gap-1.5 py-2.5 rounded-xl text-xs font-bold z-10 transition-colors duration-300 \${
                        isActive ? "text-white" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                      }\`}
                      style={isActive ? { background: "linear-gradient(135deg, rgba(108,92,231,0.8), rgba(90,75,209,0.9))", boxShadow: "0 4px 15px rgba(108,92,231,0.3)" } : {}}
                    >
                      <span>{icon}</span> {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Answer Fields */}
            <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)] rounded-[24px] p-5 shadow-inner mt-4">
              
              {/* Opsi Pilihan Ganda */}
              {activeQuestion.answerType === "multiple_choice" && (
                <div className="space-y-3 animate-fade-in">
                  <p className="text-[10px] font-bold text-[var(--accent-green)] mb-4 bg-[rgba(0,184,148,0.1)] inline-block px-3 py-1 rounded-full uppercase tracking-wider">Tap Huruf untuk set kunci jawaban</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {activeQuestion.options.map((opt) => {
                      const isCorrect = activeQuestion.correctAnswer === opt.label;
                      return (
                        <div key={opt.label} className={\`flex items-stretch rounded-2xl overflow-hidden border transition-all duration-300 \${isCorrect ? "border-[var(--accent-green)] shadow-[0_0_15px_rgba(0,184,148,0.15)] ring-1 ring-[var(--accent-green)]" : "border-[rgba(255,255,255,0.05)] bg-[rgba(0,0,0,0.3)] hover:border-[rgba(255,255,255,0.1)]"}\`}>
                          <button
                            onClick={() => updateQuestion(activeQIdx, "correctAnswer", opt.label)}
                            className={\`w-12 flex items-center justify-center font-black text-sm transition-colors \${
                              isCorrect 
                              ? "bg-[var(--accent-green)] text-white" 
                              : "bg-[rgba(255,255,255,0.03)] text-[var(--text-muted)]"
                            }\`}
                          >
                            {isCorrect ? "✓" : opt.label}
                          </button>
                          <input
                            className="w-full bg-transparent p-3 text-sm text-white placeholder-[var(--text-muted)] focus:outline-none"
                            placeholder={\`Ketikan Opsi \${opt.label}...\`}
                            value={opt.text}
                            onChange={(e) => updateOption(activeQIdx, opt.label, e.target.value)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Teks Terbuka */}
              {activeQuestion.answerType === "text" && (
                <div className="space-y-3 animate-fade-in">
                   <p className="text-[10px] font-bold text-[var(--accent-purple-light)] mb-4 bg-[rgba(108,92,231,0.1)] inline-block px-3 py-1 rounded-full uppercase tracking-wider">Variasi Jawaban Benar</p>
                  {(activeQuestion.acceptedAnswers || [""]).map((ans, ansIdx) => (
                    <div key={ansIdx} className="flex items-center gap-2">
                      <div className="w-10 h-10 flex-shrink-0 bg-[rgba(255,255,255,0.05)] flex items-center justify-center rounded-xl text-xs font-black text-[var(--accent-purple-light)] border border-[rgba(255,255,255,0.05)]">{ansIdx + 1}</div>
                      <input
                        className="flex-1 bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.05)] rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[var(--accent-purple)]"
                        placeholder={\`Matahari / Bintang / Mata hari\`}
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
                            const updated = (activeQuestion.acceptedAnswers || []).filter((_, i) => i !== ansIdx);
                            updateQuestion(activeQIdx, "acceptedAnswers", updated);
                          }}
                          className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-[rgba(255,107,107,0.1)] text-[var(--accent-red)] hover:bg-[rgba(255,107,107,0.2)] transition-colors"
                        >✕</button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const updated = [...(activeQuestion.acceptedAnswers || []), ""];
                      updateQuestion(activeQIdx, "acceptedAnswers", updated);
                    }}
                    className="w-full mt-3 py-3 rounded-xl border border-dashed border-[var(--accent-purple)] text-[var(--accent-purple-light)] hover:bg-[rgba(108,92,231,0.1)] text-xs font-bold transition-all"
                  >+ Tambah Variasi</button>
                </div>
              )}

              {/* Penjodohan */}
              {activeQuestion.answerType === "matching" && (
                <div className="space-y-3 animate-fade-in relative">
                  <p className="text-[10px] font-bold text-[var(--accent-teal, #00cec9)] mb-4 bg-[rgba(0,206,201,0.1)] inline-block px-3 py-1 rounded-full uppercase tracking-wider">Pasangkan Baris Kiri & Kanan</p>
                  
                  {/* Visual Connection Guide Background Line */}
                  <div className="absolute left-1/2 top-11 bottom-14 w-[1px] bg-gradient-to-b from-transparent via-[rgba(255,255,255,0.1)] to-transparent pointer-events-none hidden md:block" />

                  {(activeQuestion.matchPairs || []).map((pair, pairIdx) => (
                    <div key={pairIdx} className="flex flex-col md:flex-row items-center gap-2 md:gap-4 relative z-10">
                      <div className="flex-1 w-full relative">
                        <input
                          className="w-full bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.05)] rounded-xl px-4 py-3 text-sm text-center focus:outline-none focus:border-[var(--accent-blue)]"
                          placeholder="Premis Kiri..."
                          value={pair.left}
                          onChange={(e) => updateMatchPair(activeQIdx, pairIdx, "left", e.target.value)}
                        />
                      </div>
                      
                      {/* Connection node / Delete button */}
                      <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] group transition-all hover:border-[var(--accent-red)] hover:bg-[rgba(255,107,107,0.1)] cursor-pointer" onClick={() => {(activeQuestion.matchPairs || []).length > 2 && removeMatchPair(activeQIdx, pairIdx)}}>
                         <span className="text-[10px] text-[var(--text-muted)] group-hover:hidden">{(activeQuestion.matchPairs || []).length > 2 ? "↔" : "🔗"}</span>
                         <span className="text-[10px] text-[var(--accent-red)] hidden group-hover:block w-full h-full flex items-center justify-center">✕</span>
                      </div>
                      
                      <div className="flex-1 w-full">
                        <input
                          className="w-full bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.05)] rounded-xl px-4 py-3 text-sm text-center focus:outline-none focus:border-[var(--accent-purple)]"
                          placeholder="Jawaban Kanan..."
                          value={pair.right}
                          onChange={(e) => updateMatchPair(activeQIdx, pairIdx, "right", e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => addMatchPair(activeQIdx)}
                    className="w-full mt-4 py-3 rounded-xl border border-dashed border-[var(--text-muted)] text-[var(--text-secondary)] hover:border-white hover:text-white text-xs font-bold transition-all bg-[rgba(0,0,0,0.2)] hover:bg-[rgba(255,255,255,0.05)]"
                  >+ Tambah Pasangan</button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* spacer bottom untuk navigasi mobile */}
      <div className="h-10"></div>

    </div>
  );
}`;

fs.writeFileSync(path, topPart + newContent, 'utf8');
console.log("Rewrite successful!");
