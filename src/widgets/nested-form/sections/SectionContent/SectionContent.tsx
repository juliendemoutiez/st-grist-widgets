import '../sections.scss';
import type { SectionConfig, TimelineSectionConfig, CommentSectionConfig } from '@grist-widgets/ui';
import { TimelineSection } from '../TimelineSection/TimelineSection';
import { SubtasksSection } from '../SubtasksSection/SubtasksSection';
import { CommentSection } from '../CommentSection/CommentSection';

interface SectionContentProps {
  section: SectionConfig;
  recordId: number;
  parentTable: string;
}

export function SectionContent({ section, recordId, parentTable }: SectionContentProps) {
  if (section.type === 'timeline') {
    const { type: _type, ...config } = section as TimelineSectionConfig;
    return <TimelineSection config={config} filterId={recordId} />;
  }
  if (section.type === 'tasks') {
    return <SubtasksSection table={section.table} col={section.col} parentId={recordId} title={section.title} icon={section.icon} />;
  }
  if (section.type === 'comment') {
    const s = section as CommentSectionConfig;
    return <CommentSection table={parentTable} col={s.col} parentId={recordId} title={s.title} icon={s.icon} />;
  }
  return null;
}
