"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { Play, X, ArrowRight } from "@phosphor-icons/react";

export function PreviewDialog({
  courseSlug = "market-foundations",
  label = "Inside the lessons",
  large = false,
}: {
  courseSlug?: string;
  label?: string;
  large?: boolean;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className={large ? "sample-play-button" : "button button-secondary"}>
          <Play size={large ? 24 : 15} weight="fill" />
          {label}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="preview-dialog">
          <Dialog.Close className="dialog-close icon-button" aria-label="Close lesson preview">
            <X size={22} />
          </Dialog.Close>
          <div className="preview-dialog-art">
            <span className="preview-play-symbol">
              <Play size={30} weight="fill" />
            </span>
            <span>Hindi lessons. A clear learning path.</span>
          </div>
          <div className="preview-dialog-copy">
            <Dialog.Title>Understand the thinking behind a trade.</Dialog.Title>
            <Dialog.Description>
              This is a written preview of the proposed lesson format. The instructor’s video
              trailer has not been supplied yet.
            </Dialog.Description>
            <ol className="lesson-format">
              <li>
                <strong>The concept</strong>
                <span>Start with an idea, explained in plain language.</span>
              </li>
              <li>
                <strong>The context</strong>
                <span>Examine a worked example, including its limitations.</span>
              </li>
              <li>
                <strong>The process</strong>
                <span>Turn your observations into a reviewable checklist.</span>
              </li>
            </ol>
            <Dialog.Close asChild>
              <Link className="button button-primary" href={`/courses/${courseSlug}#curriculum`}>
                See the curriculum <ArrowRight size={17} />
              </Link>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
