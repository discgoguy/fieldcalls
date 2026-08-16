// Reconstructs the full "old shape" checklist item (task_description, category,
// task_type, options, section_name, part_triggers) by merging a compact
// checklist_items row with its task definition in the template — so
// ChecklistDetail.jsx and ChecklistPrintLayout.jsx can keep consuming the exact
// same shape they always have, with zero changes to their rendering logic.
// ConvertToServiceModal.jsx reads part_triggers (an array of
// { trigger_response, parts: [{ part_id, quantity }] }) to support multiple
// trigger options and multiple parts per task.
//
// Items created before the storage migration (or whose template was edited
// afterward and no longer has a matching task) already carry their own
// descriptive fields inline — those pass through unchanged, including their
// original single linked_part_id/linked_part_quantity/trigger_response fields,
// which ConvertToServiceModal falls back to when part_triggers isn't present.

function buildTaskLookup(templates) {
    const lookup = {};
    for (const template of templates || []) {
        const taskMap = {};
        for (const section of template.sections || []) {
            for (const task of section.tasks || []) {
                if (task.task_key) {
                    taskMap[task.task_key] = {
                        task_description: task.description,
                        category: task.category,
                        task_type: task.task_type,
                        options: task.options || [],
                        section_name: section.section_name,
                        part_triggers: task.part_triggers || [],
                        force_new_page: section.force_new_page || false,
                    };
                }
            }
        }
        lookup[template.id] = taskMap;
    }
    return lookup;
}

export function enrichChecklistItems(items, templates) {
    const lookup = buildTaskLookup(templates);
    return (items || []).map(item => {
        // Legacy item: created before the migration, or its template task no
        // longer exists under the same key — already has everything inline.
        if (!item.task_key) {
            return item;
        }
        const taskData = lookup[item.template_id]?.[item.task_key];
        return taskData ? { ...item, ...taskData } : item;
    });
}
